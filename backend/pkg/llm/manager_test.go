package llm

import (
	"context"
	"errors"
	"strings"
	"testing"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/telemetry"
)

// ── Mock Provider ─────────────────────────────────────────────────────────────

type mockProvider struct {
	name        string
	chatResp    *ChatResponse
	chatErr     error
	models      []ModelInfo
	healthErr   error
	chatCalled  int
}

func (m *mockProvider) Name() string { return m.name }

func (m *mockProvider) Chat(_ context.Context, _ ChatRequest) (*ChatResponse, error) {
	m.chatCalled++
	return m.chatResp, m.chatErr
}

func (m *mockProvider) ChatStream(_ context.Context, _ ChatRequest, ch chan<- StreamChunk) error {
	close(ch)
	return nil
}

func (m *mockProvider) ListModels(_ context.Context) ([]ModelInfo, error) {
	return m.models, nil
}

func (m *mockProvider) HealthCheck(_ context.Context) error {
	return m.healthErr
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func newNopManager() *Manager {
	return NewManager(zap.NewNop()).WithTracer(telemetry.NewLangfuse(false, "", "", ""))
}

func okResp(content string) *ChatResponse {
	return &ChatResponse{
		ID:         "test-id",
		Content:    content,
		StopReason: "end_turn",
		Usage:      Usage{InputTokens: 10, OutputTokens: 5},
	}
}

// ── Tests: Register / Get / Default ──────────────────────────────────────────

func TestRegister(t *testing.T) {
	m := newNopManager()
	p := &mockProvider{name: "alpha"}
	m.Register(p)

	got, err := m.Get("alpha")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name() != "alpha" {
		t.Errorf("expected alpha, got %s", got.Name())
	}
}

func TestRegister_Multiple(t *testing.T) {
	m := newNopManager()
	m.Register(&mockProvider{name: "alpha"})
	m.Register(&mockProvider{name: "beta"})
	m.Register(&mockProvider{name: "gamma"})

	for _, name := range []string{"alpha", "beta", "gamma"} {
		if _, err := m.Get(name); err != nil {
			t.Errorf("Get(%s): %v", name, err)
		}
	}
}

func TestGet_NotFound(t *testing.T) {
	m := newNopManager()
	_, err := m.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error for unknown provider")
	}
	if !strings.Contains(err.Error(), "not registered") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestDefault_Empty(t *testing.T) {
	m := newNopManager()
	_, err := m.Default()
	if err == nil {
		t.Fatal("expected error with no providers")
	}
}

func TestDefault_ReturnsFirst(t *testing.T) {
	m := newNopManager()
	m.Register(&mockProvider{name: "first"})
	m.Register(&mockProvider{name: "second"})

	p, err := m.Default()
	if err != nil {
		t.Fatalf("Default: %v", err)
	}
	if p.Name() != "first" {
		t.Errorf("expected first, got %s", p.Name())
	}
}

// ── Tests: Chat + Fallback ────────────────────────────────────────────────────

func TestChat_Success(t *testing.T) {
	m := newNopManager()
	p := &mockProvider{name: "alpha", chatResp: okResp("hello")}
	m.Register(p)

	resp, err := m.Chat(context.Background(), "alpha", ChatRequest{Model: "test"})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if resp.Content != "hello" {
		t.Errorf("expected 'hello', got %q", resp.Content)
	}
	if p.chatCalled != 1 {
		t.Errorf("expected 1 call, got %d", p.chatCalled)
	}
}

func TestChat_FallsBackOnError(t *testing.T) {
	m := newNopManager()
	failing := &mockProvider{name: "alpha", chatErr: errors.New("unavailable")}
	working := &mockProvider{name: "beta", chatResp: okResp("fallback")}
	m.Register(failing)
	m.Register(working)

	resp, err := m.Chat(context.Background(), "alpha", ChatRequest{Model: "test"})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if resp.Content != "fallback" {
		t.Errorf("expected 'fallback', got %q", resp.Content)
	}
	if failing.chatCalled != 1 {
		t.Errorf("failing provider called %d times, want 1", failing.chatCalled)
	}
	if working.chatCalled != 1 {
		t.Errorf("working provider called %d times, want 1", working.chatCalled)
	}
}

func TestChat_AllProvidersFail(t *testing.T) {
	m := newNopManager()
	m.Register(&mockProvider{name: "alpha", chatErr: errors.New("err-a")})
	m.Register(&mockProvider{name: "beta", chatErr: errors.New("err-b")})

	_, err := m.Chat(context.Background(), "alpha", ChatRequest{Model: "test"})
	if err == nil {
		t.Fatal("expected error when all providers fail")
	}
	if !strings.Contains(err.Error(), "all LLM providers failed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestChat_UnknownProvider_FallsBackToAll(t *testing.T) {
	m := newNopManager()
	p := &mockProvider{name: "alpha", chatResp: okResp("ok")}
	m.Register(p)

	// Requesting unknown provider falls back to first registered
	resp, err := m.Chat(context.Background(), "unknown", ChatRequest{Model: "test"})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if resp.Content != "ok" {
		t.Errorf("expected 'ok', got %q", resp.Content)
	}
}

// ── Tests: buildFallbackChain ─────────────────────────────────────────────────

func TestBuildFallbackChain_PreferredFirst(t *testing.T) {
	chain := buildFallbackChain("beta", []string{"alpha", "beta", "gamma"})
	if chain[0] != "beta" {
		t.Errorf("expected beta first, got %s", chain[0])
	}
	if len(chain) != 3 {
		t.Errorf("expected 3 entries, got %d", len(chain))
	}
}

func TestBuildFallbackChain_EmptyPreferred(t *testing.T) {
	chain := buildFallbackChain("", []string{"alpha", "beta"})
	if len(chain) != 2 {
		t.Errorf("expected 2 entries, got %d", len(chain))
	}
	if chain[0] != "alpha" {
		t.Errorf("expected alpha first, got %s", chain[0])
	}
}

func TestBuildFallbackChain_NoDuplicates(t *testing.T) {
	chain := buildFallbackChain("alpha", []string{"alpha", "beta", "gamma"})
	seen := map[string]int{}
	for _, c := range chain {
		seen[c]++
	}
	for name, count := range seen {
		if count > 1 {
			t.Errorf("duplicate %q in fallback chain (count=%d)", name, count)
		}
	}
}

// ── Tests: buildPromptSnippet ─────────────────────────────────────────────────

func TestBuildPromptSnippet_Empty(t *testing.T) {
	snippet := buildPromptSnippet(ChatRequest{})
	if snippet != "" {
		t.Errorf("expected empty snippet, got %q", snippet)
	}
}

func TestBuildPromptSnippet_SystemOnly(t *testing.T) {
	snippet := buildPromptSnippet(ChatRequest{SystemPrompt: "You are a helper."})
	if !strings.Contains(snippet, "[system]") {
		t.Errorf("expected [system] prefix, got %q", snippet)
	}
	if !strings.Contains(snippet, "You are a helper.") {
		t.Errorf("expected system prompt content, got %q", snippet)
	}
}

func TestBuildPromptSnippet_LongSystemTruncated(t *testing.T) {
	long := strings.Repeat("x", 1000)
	snippet := buildPromptSnippet(ChatRequest{SystemPrompt: long})
	// Should be truncated to 500 + "…"
	if len(snippet) > 600 {
		t.Errorf("snippet not truncated: len=%d", len(snippet))
	}
	if !strings.HasSuffix(snippet, "…") {
		t.Errorf("expected ellipsis suffix, got %q", snippet[len(snippet)-5:])
	}
}

func TestBuildPromptSnippet_Messages(t *testing.T) {
	req := ChatRequest{
		Messages: []Message{
			{Role: RoleUser, Content: "What is 2+2?"},
			{Role: RoleAssistant, Content: "4"},
		},
	}
	snippet := buildPromptSnippet(req)
	if !strings.Contains(snippet, "[user]") {
		t.Errorf("expected [user] tag")
	}
	if !strings.Contains(snippet, "[assistant]") {
		t.Errorf("expected [assistant] tag")
	}
	if !strings.Contains(snippet, "What is 2+2?") {
		t.Errorf("expected user message")
	}
}

func TestBuildPromptSnippet_TotalCap(t *testing.T) {
	// Build request that would exceed 2KB
	req := ChatRequest{
		SystemPrompt: strings.Repeat("s", 600),
		Messages: []Message{
			{Role: RoleUser, Content: strings.Repeat("u", 600)},
			{Role: RoleUser, Content: strings.Repeat("v", 600)},
			{Role: RoleUser, Content: strings.Repeat("w", 600)},
		},
	}
	snippet := buildPromptSnippet(req)
	if len(snippet) > 2060 { // 2048 + "…"
		t.Errorf("snippet exceeds 2KB cap: len=%d", len(snippet))
	}
}

// ── Tests: HealthCheck ────────────────────────────────────────────────────────

func TestHealthCheck(t *testing.T) {
	m := newNopManager()
	m.Register(&mockProvider{name: "alpha", healthErr: nil})
	m.Register(&mockProvider{name: "beta", healthErr: errors.New("timeout")})

	statuses := m.HealthCheck(context.Background())
	if statuses["alpha"] != nil {
		t.Errorf("alpha should be healthy, got %v", statuses["alpha"])
	}
	if statuses["beta"] == nil {
		t.Error("beta should be unhealthy")
	}
}
