package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"go.uber.org/zap"
)

// Manager holds all registered MCP server clients and provides unified access.
type Manager struct {
	mu      sync.RWMutex
	servers map[string]*Client
	tools   map[string][]ToolInfo // cached tool list per server
	log     *zap.Logger
}

// NewManager creates a new MCP manager.
func NewManager(log *zap.Logger) *Manager {
	return &Manager{
		servers: make(map[string]*Client),
		tools:   make(map[string][]ToolInfo),
		log:     log,
	}
}

// Register adds an MCP server client.
func (m *Manager) Register(name, baseURL string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.servers[name] = NewClient(name, baseURL)
	m.log.Info("registered MCP server", zap.String("name", name), zap.String("url", baseURL))
}

// Call invokes a tool on the named MCP server.
func (m *Manager) Call(ctx context.Context, serverName, toolName string, input json.RawMessage) (string, error) {
	m.mu.RLock()
	client, ok := m.servers[serverName]
	m.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("MCP server %q not registered", serverName)
	}
	return client.Call(ctx, toolName, input)
}

// DiscoverTools queries all registered MCP servers and caches their tool lists.
func (m *Manager) DiscoverTools(ctx context.Context) {
	m.mu.RLock()
	names := make([]string, 0, len(m.servers))
	for name := range m.servers {
		names = append(names, name)
	}
	m.mu.RUnlock()

	for _, name := range names {
		m.mu.RLock()
		client := m.servers[name]
		m.mu.RUnlock()

		tools, err := client.ListTools(ctx)
		if err != nil {
			m.log.Warn("failed to discover tools from MCP server",
				zap.String("server", name), zap.Error(err))
			continue
		}

		m.mu.Lock()
		m.tools[name] = tools
		m.mu.Unlock()

		m.log.Info("discovered MCP tools",
			zap.String("server", name),
			zap.Int("count", len(tools)),
		)
	}
}

// HealthCheck checks all registered MCP servers.
func (m *Manager) HealthCheck(ctx context.Context) map[string]error {
	m.mu.RLock()
	names := make([]string, 0, len(m.servers))
	for name := range m.servers {
		names = append(names, name)
	}
	m.mu.RUnlock()

	type result struct {
		name string
		err  error
	}
	ch := make(chan result, len(names))

	for _, name := range names {
		go func(n string) {
			m.mu.RLock()
			c := m.servers[n]
			m.mu.RUnlock()
			ch <- result{name: n, err: c.HealthCheck(ctx)}
		}(name)
	}

	statuses := make(map[string]error)
	for range names {
		r := <-ch
		statuses[r.name] = r.err
	}
	return statuses
}

// Close tears down all SSE connections to MCP servers.
func (m *Manager) Close() {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, client := range m.servers {
		client.Close()
	}
}
