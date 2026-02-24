package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/pentagron/pentagron/pkg/llm"
)

// Tool is a single capability available to agents.
type Tool struct {
	Name        string
	Description string
	InputSchema json.RawMessage // JSON Schema for input validation
	AgentTypes  []string        // which agent types may use this tool
	Phases      []string        // which phases this tool is allowed in
	Execute     func(ctx context.Context, input json.RawMessage) (string, error)
}

// Registry holds all registered tools and provides phase-gated execution.
type Registry struct {
	mu    sync.RWMutex
	tools map[string]*Tool
}

// NewRegistry creates an empty tool registry.
func NewRegistry() *Registry {
	return &Registry{tools: make(map[string]*Tool)}
}

// Register adds a tool to the registry.
func (r *Registry) Register(t Tool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[t.Name] = &t
}

// Execute runs a named tool with the given input JSON.
func (r *Registry) Execute(ctx context.Context, name string, input json.RawMessage) (string, error) {
	r.mu.RLock()
	t, ok := r.tools[name]
	r.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("tool %q not found", name)
	}
	return t.Execute(ctx, input)
}

// ToolDefinitions returns the LLM-facing tool definitions scoped to an agent type.
func (r *Registry) ToolDefinitions(agentType interface{ String() string }) []llm.ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	at := agentType.String()
	var defs []llm.ToolDefinition
	for _, t := range r.tools {
		if toolAllowedForAgent(t.AgentTypes, at) {
			defs = append(defs, llm.ToolDefinition{
				Name:        t.Name,
				Description: t.Description,
				InputSchema: t.InputSchema,
			})
		}
	}
	return defs
}

// All returns all registered tool names.
func (r *Registry) All() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}
	return names
}

func toolAllowedForAgent(allowed []string, agentType string) bool {
	if len(allowed) == 0 {
		return true // no restriction = available to all
	}
	for _, a := range allowed {
		if a == agentType || a == "*" {
			return true
		}
	}
	return false
}
