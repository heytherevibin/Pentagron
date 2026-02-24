package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// AnthropicProvider implements Provider using the official Anthropic SDK.
type AnthropicProvider struct {
	client  *anthropic.Client
	baseURL string
}

// NewAnthropic creates a new Anthropic provider.
func NewAnthropic(apiKey, baseURL string) *AnthropicProvider {
	opts := []option.RequestOption{option.WithAPIKey(apiKey)}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}
	client := anthropic.NewClient(opts...)
	return &AnthropicProvider{client: &client, baseURL: baseURL}
}

func (p *AnthropicProvider) Name() string { return "anthropic" }

func (p *AnthropicProvider) HealthCheck(ctx context.Context) error {
	_, err := p.ListModels(ctx)
	return err
}

func (p *AnthropicProvider) ListModels(_ context.Context) ([]ModelInfo, error) {
	return []ModelInfo{
		{ID: "claude-opus-4-6", Name: "Claude Opus 4.6", Provider: "anthropic", ContextSize: 200000},
		{ID: "claude-sonnet-4-6", Name: "Claude Sonnet 4.6", Provider: "anthropic", ContextSize: 200000},
		{ID: "claude-haiku-4-5-20251001", Name: "Claude Haiku 4.5", Provider: "anthropic", ContextSize: 200000},
	}, nil
}

func (p *AnthropicProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	params := p.buildParams(req)

	msg, err := p.client.Messages.New(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("anthropic chat: %w", err)
	}

	return p.convertResponse(msg), nil
}

func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, ch chan<- StreamChunk) error {
	params := p.buildParams(req)

	stream := p.client.Messages.NewStreaming(ctx, params)
	defer stream.Close()

	for stream.Next() {
		event := stream.Current()
		switch e := event.AsUnion().(type) {
		case anthropic.ContentBlockDeltaEvent:
			if delta, ok := e.Delta.AsUnion().(anthropic.TextDelta); ok {
				ch <- StreamChunk{Delta: delta.Text}
			}
		}
	}

	if err := stream.Err(); err != nil {
		ch <- StreamChunk{Error: err, Done: true}
		return err
	}

	ch <- StreamChunk{Done: true}
	return nil
}

func (p *AnthropicProvider) buildParams(req ChatRequest) anthropic.MessageNewParams {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 8192
	}

	// Convert messages
	var msgs []anthropic.MessageParam
	for _, m := range req.Messages {
		switch m.Role {
		case RoleUser:
			msgs = append(msgs, anthropic.NewUserMessage(anthropic.NewTextBlock(m.Content)))
		case RoleAssistant:
			msgs = append(msgs, anthropic.NewAssistantMessage(anthropic.NewTextBlock(m.Content)))
		case RoleTool:
			msgs = append(msgs, anthropic.NewUserMessage(
				anthropic.NewToolResultBlock(m.ToolCallID, m.Content, false),
			))
		}
	}

	// Convert tool definitions
	var tools []anthropic.ToolUnionParam
	for _, t := range req.Tools {
		tools = append(tools, anthropic.ToolParam{
			Name:        t.Name,
			Description: anthropic.String(t.Description),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: t.InputSchema,
			},
		})
	}

	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(req.Model),
		MaxTokens: int64(maxTokens),
		Messages:  msgs,
	}
	if req.SystemPrompt != "" {
		params.System = []anthropic.TextBlockParam{
			{Text: req.SystemPrompt},
		}
	}
	if len(tools) > 0 {
		params.Tools = tools
	}

	return params
}

func (p *AnthropicProvider) convertResponse(msg *anthropic.Message) *ChatResponse {
	resp := &ChatResponse{
		ID:    msg.ID,
		Model: string(msg.Model),
		Usage: Usage{
			InputTokens:  int(msg.Usage.InputTokens),
			OutputTokens: int(msg.Usage.OutputTokens),
		},
	}

	switch msg.StopReason {
	case anthropic.MessageStopReasonEndTurn:
		resp.StopReason = "end_turn"
	case anthropic.MessageStopReasonToolUse:
		resp.StopReason = "tool_use"
	case anthropic.MessageStopReasonMaxTokens:
		resp.StopReason = "max_tokens"
	}

	for _, block := range msg.Content {
		switch b := block.AsUnion().(type) {
		case anthropic.TextBlock:
			resp.Content = b.Text
		case anthropic.ToolUseBlock:
			inputBytes, _ := json.Marshal(b.Input)
			resp.ToolCalls = append(resp.ToolCalls, ToolCall{
				ID:    b.ID,
				Name:  b.Name,
				Input: inputBytes,
			})
		}
	}

	return resp
}
