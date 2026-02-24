package llm

import (
	"context"
	"encoding/json"
)

// ── Types ──────────────────────────────────────────────────────────────────────

// Role represents the role of a message in a conversation.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// Message is a single turn in a conversation.
type Message struct {
	Role       Role        `json:"role"`
	Content    string      `json:"content"`
	ToolCallID string      `json:"tool_call_id,omitempty"` // for tool result messages
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`
}

// ToolCall is a structured request from the LLM to invoke a tool.
type ToolCall struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Input    json.RawMessage `json:"input"`
}

// ToolDefinition describes a tool available to the LLM.
type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"` // JSON Schema object
}

// ChatRequest is the input to a chat completion call.
type ChatRequest struct {
	Model       string           `json:"model"`
	Messages    []Message        `json:"messages"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	Temperature float64          `json:"temperature,omitempty"`
	SystemPrompt string          `json:"system_prompt,omitempty"`
}

// ChatResponse is the output of a chat completion call.
type ChatResponse struct {
	ID         string     `json:"id"`
	Model      string     `json:"model"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	StopReason string     `json:"stop_reason"` // end_turn | tool_use | max_tokens
	Usage      Usage      `json:"usage"`
}

// Usage contains token consumption information.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// StreamChunk is a single chunk in a streaming response.
type StreamChunk struct {
	Delta     string     `json:"delta"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
	Done      bool       `json:"done"`
	Error     error      `json:"-"`
}

// ModelInfo describes a model available from a provider.
type ModelInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Provider    string `json:"provider"`
	ContextSize int    `json:"context_size,omitempty"`
}

// ── Provider interface ────────────────────────────────────────────────────────

// Provider is the unified interface all LLM backends must implement.
type Provider interface {
	// Chat sends a chat completion request and returns the full response.
	Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error)

	// ChatStream sends a chat completion request and streams chunks to ch.
	// The channel is closed when streaming is complete.
	ChatStream(ctx context.Context, req ChatRequest, ch chan<- StreamChunk) error

	// ListModels returns the models available from this provider.
	ListModels(ctx context.Context) ([]ModelInfo, error)

	// Name returns the provider identifier (e.g. "anthropic", "openai").
	Name() string

	// HealthCheck verifies that the provider is reachable and configured.
	HealthCheck(ctx context.Context) error
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// HasToolCalls returns true if the response includes tool call requests.
func (r *ChatResponse) HasToolCalls() bool {
	return len(r.ToolCalls) > 0
}

// IsText returns true if the response is a plain text message (no tool calls).
func (r *ChatResponse) IsText() bool {
	return r.Content != "" && !r.HasToolCalls()
}

// ToolResultMessage constructs a tool result message to append after a tool call.
func ToolResultMessage(toolCallID, result string) Message {
	return Message{
		Role:       RoleTool,
		Content:    result,
		ToolCallID: toolCallID,
	}
}
