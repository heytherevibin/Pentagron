package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/shared"
)

// OpenAIProvider implements Provider for OpenAI (and any OpenAI-compatible API).
// Used for: OpenAI, OpenRouter, DeepSeek.
type OpenAIProvider struct {
	client       *openai.Client
	providerName string
	baseURL      string
}

// NewOpenAI creates an OpenAI provider.
func NewOpenAI(apiKey, baseURL, providerName string) *OpenAIProvider {
	opts := []option.RequestOption{option.WithAPIKey(apiKey)}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}
	client := openai.NewClient(opts...)
	return &OpenAIProvider{client: client, providerName: providerName, baseURL: baseURL}
}

// NewOpenRouter creates an OpenRouter provider (OpenAI-compatible).
func NewOpenRouter(apiKey string) *OpenAIProvider {
	return NewOpenAI(apiKey, "https://openrouter.ai/api/v1", "openrouter")
}

// NewDeepSeek creates a DeepSeek provider (OpenAI-compatible).
func NewDeepSeek(apiKey string) *OpenAIProvider {
	return NewOpenAI(apiKey, "https://api.deepseek.com/v1", "deepseek")
}

func (p *OpenAIProvider) Name() string { return p.providerName }

func (p *OpenAIProvider) HealthCheck(ctx context.Context) error {
	_, err := p.ListModels(ctx)
	return err
}

func (p *OpenAIProvider) ListModels(ctx context.Context) ([]ModelInfo, error) {
	page, err := p.client.Models.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("%s list models: %w", p.providerName, err)
	}

	var models []ModelInfo
	for _, m := range page.Data {
		models = append(models, ModelInfo{
			ID:       m.ID,
			Name:     m.ID,
			Provider: p.providerName,
		})
	}
	return models, nil
}

func (p *OpenAIProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	params := p.buildParams(req)

	completion, err := p.client.Chat.Completions.New(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("%s chat: %w", p.providerName, err)
	}

	return p.convertResponse(completion), nil
}

func (p *OpenAIProvider) ChatStream(ctx context.Context, req ChatRequest, ch chan<- StreamChunk) error {
	params := p.buildParams(req)

	stream := p.client.Chat.Completions.NewStreaming(ctx, params)
	defer func() { _ = stream.Close() }()

	acc := openai.ChatCompletionAccumulator{}
	for stream.Next() {
		chunk := stream.Current()
		acc.AddChunk(chunk)
		if len(chunk.Choices) > 0 {
			delta := chunk.Choices[0].Delta.Content
			if delta != "" {
				ch <- StreamChunk{Delta: delta}
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

func (p *OpenAIProvider) buildParams(req ChatRequest) openai.ChatCompletionNewParams {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 8192
	}

	var msgs []openai.ChatCompletionMessageParamUnion
	for _, m := range req.Messages {
		switch m.Role {
		case RoleSystem:
			msgs = append(msgs, openai.SystemMessage(m.Content))
		case RoleUser:
			msgs = append(msgs, openai.UserMessage(m.Content))
		case RoleAssistant:
			msgs = append(msgs, openai.AssistantMessage(m.Content))
		case RoleTool:
			msgs = append(msgs, openai.ToolMessage(m.ToolCallID, m.Content))
		}
	}

	if req.SystemPrompt != "" {
		msgs = append([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(req.SystemPrompt),
		}, msgs...)
	}

	var tools []openai.ChatCompletionToolParam
	for _, t := range req.Tools {
		var schema map[string]interface{}
		_ = json.Unmarshal(t.InputSchema, &schema)
		if schema == nil {
			schema = map[string]interface{}{}
		}
		tools = append(tools, openai.ChatCompletionToolParam{
			Function: openai.F(shared.FunctionDefinitionParam{
				Name:        openai.F(t.Name),
				Description: openai.F(t.Description),
				Parameters:  openai.F(openai.FunctionParameters(schema)),
			}),
		})
	}

	params := openai.ChatCompletionNewParams{
		Model:     openai.F(openai.ChatModel(req.Model)),
		Messages:  openai.F(msgs),
		MaxTokens: openai.F(int64(maxTokens)),
	}
	if len(tools) > 0 {
		params.Tools = openai.F(tools)
	}
	return params
}

func (p *OpenAIProvider) convertResponse(c *openai.ChatCompletion) *ChatResponse {
	if len(c.Choices) == 0 {
		return &ChatResponse{Model: c.Model}
	}

	choice := c.Choices[0]
	resp := &ChatResponse{
		ID:         c.ID,
		Model:      c.Model,
		Content:    choice.Message.Content,
		StopReason: string(choice.FinishReason),
		Usage: Usage{
			InputTokens:  int(c.Usage.PromptTokens),
			OutputTokens: int(c.Usage.CompletionTokens),
		},
	}

	for _, tc := range choice.Message.ToolCalls {
		resp.ToolCalls = append(resp.ToolCalls, ToolCall{
			ID:    tc.ID,
			Name:  tc.Function.Name,
			Input: json.RawMessage(tc.Function.Arguments),
		})
	}

	return resp
}
