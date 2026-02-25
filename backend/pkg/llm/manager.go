package llm

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/telemetry"
)

// Manager holds all registered LLM providers and handles health checking,
// model discovery, and fallback routing.
type Manager struct {
	mu        sync.RWMutex
	providers map[string]Provider // keyed by provider name
	order     []string            // insertion order for fallback
	log       *zap.Logger
	tracer    *telemetry.LangfuseClient
}

// NewManager creates a new LLM manager.
func NewManager(log *zap.Logger) *Manager {
	return &Manager{
		providers: make(map[string]Provider),
		log:       log,
		tracer:    telemetry.NewLangfuse(false, "", "", ""), // disabled by default
	}
}

// WithTracer attaches a Langfuse client so every Chat() call is traced.
func (m *Manager) WithTracer(t *telemetry.LangfuseClient) *Manager {
	m.tracer = t
	return m
}

// Register adds a provider to the manager.
func (m *Manager) Register(p Provider) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.providers[p.Name()] = p
	m.order = append(m.order, p.Name())
	m.log.Info("registered LLM provider", zap.String("provider", p.Name()))
}

// Get returns the provider with the given name.
func (m *Manager) Get(name string) (Provider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.providers[name]
	if !ok {
		return nil, fmt.Errorf("LLM provider %q not registered", name)
	}
	return p, nil
}

// Default returns the first registered provider.
func (m *Manager) Default() (Provider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if len(m.order) == 0 {
		return nil, fmt.Errorf("no LLM providers registered")
	}
	return m.providers[m.order[0]], nil
}

// Chat dispatches a chat request to the named provider, falling back to the
// next available provider on error. Each successful call is traced via Langfuse.
func (m *Manager) Chat(ctx context.Context, providerName string, req ChatRequest) (*ChatResponse, error) {
	m.mu.RLock()
	order := make([]string, len(m.order))
	copy(order, m.order)
	m.mu.RUnlock()

	// Put requested provider first in fallback chain
	chain := buildFallbackChain(providerName, order)

	var lastErr error
	for _, name := range chain {
		p, err := m.Get(name)
		if err != nil {
			continue
		}
		start := time.Now()
		resp, err := p.Chat(ctx, req)
		if err != nil {
			m.log.Warn("LLM provider error, trying fallback",
				zap.String("provider", name),
				zap.Error(err),
			)
			lastErr = err
			continue
		}

		// Trace successful call to Langfuse
		latency := time.Since(start)
		traceID := req.SystemPrompt // use a stable identifier if available
		if traceID == "" {
			traceID = "unknown"
		}
		// Truncate to avoid huge payloads — keep first 2KB of prompt
		promptSnippet := buildPromptSnippet(req)
		go m.tracer.TraceGeneration(ctx,
			traceID, "llm-chat", name, req.Model,
			promptSnippet, resp.Content,
			resp.Usage.InputTokens, resp.Usage.OutputTokens,
			latency,
		)

		return resp, nil
	}
	return nil, fmt.Errorf("all LLM providers failed: %w", lastErr)
}

// buildPromptSnippet creates a concise prompt summary for tracing (max 2KB).
func buildPromptSnippet(req ChatRequest) string {
	var parts []string
	if req.SystemPrompt != "" {
		sp := req.SystemPrompt
		if len(sp) > 500 {
			sp = sp[:500] + "…"
		}
		parts = append(parts, "[system] "+sp)
	}
	for _, msg := range req.Messages {
		content := msg.Content
		if len(content) > 300 {
			content = content[:300] + "…"
		}
		parts = append(parts, "["+string(msg.Role)+"] "+content)
	}
	snippet := strings.Join(parts, "\n")
	if len(snippet) > 2048 {
		snippet = snippet[:2048] + "…"
	}
	return snippet
}

// AllModels queries all registered providers in parallel and returns all available models.
func (m *Manager) AllModels(ctx context.Context) ([]ModelInfo, error) {
	m.mu.RLock()
	names := make([]string, len(m.order))
	copy(names, m.order)
	m.mu.RUnlock()

	type result struct {
		models []ModelInfo
		err    error
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ch := make(chan result, len(names))
	for _, name := range names {
		go func(n string) {
			p, err := m.Get(n)
			if err != nil {
				ch <- result{err: err}
				return
			}
			models, err := p.ListModels(ctx)
			ch <- result{models: models, err: err}
		}(name)
	}

	var all []ModelInfo
	for range names {
		r := <-ch
		if r.err != nil {
			m.log.Warn("failed to list models from provider", zap.Error(r.err))
			continue
		}
		all = append(all, r.models...)
	}
	return all, nil
}

// HealthCheck checks all providers and returns a status map.
func (m *Manager) HealthCheck(ctx context.Context) map[string]error {
	m.mu.RLock()
	names := make([]string, len(m.order))
	copy(names, m.order)
	m.mu.RUnlock()

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	type result struct {
		name string
		err  error
	}

	ch := make(chan result, len(names))
	for _, name := range names {
		go func(n string) {
			p, _ := m.Get(n)
			if p == nil {
				ch <- result{name: n, err: fmt.Errorf("not found")}
				return
			}
			ch <- result{name: n, err: p.HealthCheck(ctx)}
		}(name)
	}

	statuses := make(map[string]error, len(names))
	for range names {
		r := <-ch
		statuses[r.name] = r.err
	}
	return statuses
}

// buildFallbackChain puts the preferred provider first and appends the rest.
func buildFallbackChain(preferred string, all []string) []string {
	if preferred == "" {
		return all
	}
	chain := []string{preferred}
	for _, name := range all {
		if name != preferred {
			chain = append(chain, name)
		}
	}
	return chain
}
