package agent

import (
	"strings"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/llm"
)

// Reflector detects when an LLM produces a plain-text response instead of a
// structured tool call, and generates a correction message to redirect it.
// See docs/architecture.md for design rationale.
type Reflector struct {
	log *zap.Logger
}

// NewReflector creates a new Reflector.
func NewReflector(log *zap.Logger) *Reflector {
	return &Reflector{log: log}
}

// ShouldRedirect returns true when the response is free-text and the agent
// should have used a tool call instead.
func (r *Reflector) ShouldRedirect(resp *llm.ChatResponse) bool {
	if resp == nil {
		return false
	}
	// If there are tool calls, no redirect needed
	if resp.HasToolCalls() {
		return false
	}
	// If stop reason is end_turn and there's content, it might be drift
	if resp.StopReason == "end_turn" && resp.Content != "" {
		// Allow certain natural endings
		if looksLikeFinalAnswer(resp.Content) {
			return false
		}
		return true
	}
	return false
}

// BuildRedirectMessage constructs the correction prompt injected after drift.
func (r *Reflector) BuildRedirectMessage() llm.Message {
	return llm.Message{
		Role: llm.RoleUser,
		Content: `You provided a text response but you must use a tool call to proceed.
Please use one of the available tools to continue your work.
If you have completed the task, use the "finish" tool with your final answer.
Do not provide explanations in plain text — use tools only.`,
	}
}

// looksLikeFinalAnswer returns true if the content appears to be a deliberate
// concluding statement rather than mid-task free-text drift.
func looksLikeFinalAnswer(content string) bool {
	lower := strings.ToLower(content)
	endings := []string{
		"penetration test complete",
		"assessment complete",
		"findings summary",
		"executive summary",
		"no further action",
		"task completed",
		"engagement complete",
	}
	for _, e := range endings {
		if strings.Contains(lower, e) {
			return true
		}
	}
	return false
}
