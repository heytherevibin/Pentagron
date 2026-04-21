package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OllamaProvider implements Provider using Ollama's REST API.
// Ollama exposes an OpenAI-compatible /v1/chat/completions endpoint,
// so we reuse the HTTP client pattern without the OpenAI SDK overhead.
type OllamaProvider struct {
	baseURL    string
	httpClient *http.Client
}

// NewOllama creates an Ollama provider.
func NewOllama(baseURL string) *OllamaProvider {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	return &OllamaProvider{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 10 * time.Minute, // models can be slow
		},
	}
}

func (p *OllamaProvider) Name() string { return "ollama" }

func (p *OllamaProvider) HealthCheck(ctx context.Context) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/api/version", nil)
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("ollama health: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ollama health: status %d", resp.StatusCode)
	}
	return nil
}

func (p *OllamaProvider) ListModels(ctx context.Context) ([]ModelInfo, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/api/tags", nil)
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama list models: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ollama decode models: %w", err)
	}

	var models []ModelInfo
	for _, m := range result.Models {
		models = append(models, ModelInfo{ID: m.Name, Name: m.Name, Provider: "ollama"})
	}
	return models, nil
}

func (p *OllamaProvider) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	// Use OpenAI-compatible endpoint
	body := map[string]interface{}{
		"model":    req.Model,
		"messages": p.convertMessages(req),
		"stream":   false,
	}
	if req.MaxTokens > 0 {
		body["options"] = map[string]int{"num_predict": req.MaxTokens}
	}

	b, _ := json.Marshal(body)
	httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/chat/completions", bytes.NewReader(b))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ollama chat: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama chat: status %d: %s", resp.StatusCode, string(data))
	}

	var result struct {
		ID      string `json:"id"`
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("ollama decode response: %w", err)
	}

	chatResp := &ChatResponse{
		ID:    result.ID,
		Model: result.Model,
		Usage: Usage{InputTokens: result.Usage.PromptTokens, OutputTokens: result.Usage.CompletionTokens},
	}
	if len(result.Choices) > 0 {
		chatResp.Content = result.Choices[0].Message.Content
		chatResp.StopReason = result.Choices[0].FinishReason
	}
	return chatResp, nil
}

func (p *OllamaProvider) ChatStream(ctx context.Context, req ChatRequest, ch chan<- StreamChunk) error {
	body := map[string]interface{}{
		"model":    req.Model,
		"messages": p.convertMessages(req),
		"stream":   true,
	}
	b, _ := json.Marshal(body)
	httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/chat/completions", bytes.NewReader(b))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		ch <- StreamChunk{Error: err, Done: true}
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := decoder.Decode(&chunk); err != nil {
			break
		}
		if len(chunk.Choices) > 0 {
			ch <- StreamChunk{Delta: chunk.Choices[0].Delta.Content}
		}
	}

	ch <- StreamChunk{Done: true}
	return nil
}

func (p *OllamaProvider) convertMessages(req ChatRequest) []map[string]string {
	msgs := make([]map[string]string, 0, len(req.Messages)+1)
	if req.SystemPrompt != "" {
		msgs = append(msgs, map[string]string{"role": "system", "content": req.SystemPrompt})
	}
	for _, m := range req.Messages {
		msgs = append(msgs, map[string]string{"role": string(m.Role), "content": m.Content})
	}
	return msgs
}
