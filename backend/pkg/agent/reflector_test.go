package agent

import (
	"strings"
	"testing"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/llm"
)

func newReflector() *Reflector {
	return NewReflector(zap.NewNop())
}

// ── ShouldRedirect ────────────────────────────────────────────────────────────

func TestShouldRedirect_Nil(t *testing.T) {
	r := newReflector()
	if r.ShouldRedirect(nil) {
		t.Error("ShouldRedirect(nil) should return false")
	}
}

func TestShouldRedirect_HasToolCalls(t *testing.T) {
	r := newReflector()
	resp := &llm.ChatResponse{
		StopReason: "tool_use",
		ToolCalls: []llm.ToolCall{
			{ID: "tc1", Name: "naabu_scan"},
		},
	}
	if r.ShouldRedirect(resp) {
		t.Error("ShouldRedirect should be false when response has tool calls")
	}
}

func TestShouldRedirect_EndTurnWithContent(t *testing.T) {
	r := newReflector()
	resp := &llm.ChatResponse{
		StopReason: "end_turn",
		Content:    "I think we should scan the target next.",
	}
	if !r.ShouldRedirect(resp) {
		t.Error("ShouldRedirect should be true for plain-text end_turn drift")
	}
}

func TestShouldRedirect_EndTurnEmptyContent(t *testing.T) {
	r := newReflector()
	resp := &llm.ChatResponse{
		StopReason: "end_turn",
		Content:    "",
	}
	if r.ShouldRedirect(resp) {
		t.Error("ShouldRedirect should be false for empty content")
	}
}

func TestShouldRedirect_MaxTokens(t *testing.T) {
	r := newReflector()
	resp := &llm.ChatResponse{
		StopReason: "max_tokens",
		Content:    "Truncated response.",
	}
	// max_tokens is not end_turn, so should not redirect
	if r.ShouldRedirect(resp) {
		t.Error("ShouldRedirect should be false for max_tokens stop reason")
	}
}

func TestShouldRedirect_FinalAnswerPhrases(t *testing.T) {
	r := newReflector()

	phrases := []string{
		"Penetration test complete",
		"Assessment complete — no critical findings",
		"Findings summary follows",
		"Executive summary for the board",
		"No further action required",
		"Task completed successfully",
		"Engagement complete",
	}

	for _, phrase := range phrases {
		resp := &llm.ChatResponse{
			StopReason: "end_turn",
			Content:    phrase,
		}
		if r.ShouldRedirect(resp) {
			t.Errorf("ShouldRedirect should be false for final-answer phrase: %q", phrase)
		}
	}
}

func TestShouldRedirect_FinalAnswerCaseInsensitive(t *testing.T) {
	r := newReflector()
	resp := &llm.ChatResponse{
		StopReason: "end_turn",
		Content:    "PENETRATION TEST COMPLETE — all findings documented.",
	}
	if r.ShouldRedirect(resp) {
		t.Error("ShouldRedirect should be false (case-insensitive final-answer match)")
	}
}

// ── BuildRedirectMessage ──────────────────────────────────────────────────────

func TestBuildRedirectMessage_Role(t *testing.T) {
	r := newReflector()
	msg := r.BuildRedirectMessage()
	if msg.Role != llm.RoleUser {
		t.Errorf("expected role %q, got %q", llm.RoleUser, msg.Role)
	}
}

func TestBuildRedirectMessage_Content(t *testing.T) {
	r := newReflector()
	msg := r.BuildRedirectMessage()

	if msg.Content == "" {
		t.Error("redirect message content must not be empty")
	}

	// Must instruct the agent to use a tool
	if !strings.Contains(msg.Content, "tool") {
		t.Error("redirect message must mention 'tool'")
	}
}

func TestBuildRedirectMessage_Deterministic(t *testing.T) {
	r := newReflector()
	msg1 := r.BuildRedirectMessage()
	msg2 := r.BuildRedirectMessage()
	if msg1.Content != msg2.Content {
		t.Error("BuildRedirectMessage should be deterministic")
	}
}

// ── looksLikeFinalAnswer (internal) ──────────────────────────────────────────

func TestLooksLikeFinalAnswer_Match(t *testing.T) {
	cases := []struct {
		input    string
		expected bool
	}{
		{"Penetration test complete.", true},
		{"Assessment complete.", true},
		{"Findings summary attached.", true},
		{"Executive summary below.", true},
		{"No further action needed.", true},
		{"Task completed.", true},
		{"Engagement complete.", true},
		{"The port 8080 is open.", false},
		{"Let me scan next.", false},
		{"", false},
	}

	for _, tc := range cases {
		got := looksLikeFinalAnswer(tc.input)
		if got != tc.expected {
			t.Errorf("looksLikeFinalAnswer(%q) = %v, want %v", tc.input, got, tc.expected)
		}
	}
}
