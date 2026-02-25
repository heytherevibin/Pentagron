// Package telemetry provides observability integrations (Langfuse tracing).
// Langfuse has no official Go SDK; this is a lightweight HTTP client that
// posts events to the Langfuse ingestion API v2.
package telemetry

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// LangfuseClient sends trace/generation events to a Langfuse server.
// All methods are safe for concurrent use and are no-ops when disabled.
type LangfuseClient struct {
	enabled   bool
	baseURL   string
	authToken string // base64(publicKey:secretKey)
	http      *http.Client
	mu        sync.Mutex
	batch     []langfuseEvent
}

type langfuseEvent struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Body      map[string]any `json:"body"`
	Timestamp time.Time      `json:"timestamp"`
}

type langfuseBatch struct {
	Batch []langfuseEvent `json:"batch"`
}

// NewLangfuse creates a Langfuse client. If enabled is false all methods are no-ops.
func NewLangfuse(enabled bool, publicKey, secretKey, baseURL string) *LangfuseClient {
	if !enabled || publicKey == "" || secretKey == "" {
		return &LangfuseClient{enabled: false}
	}
	token := base64.StdEncoding.EncodeToString([]byte(publicKey + ":" + secretKey))
	return &LangfuseClient{
		enabled:   true,
		baseURL:   baseURL,
		authToken: token,
		http:      &http.Client{Timeout: 5 * time.Second},
	}
}

// TraceGeneration records a single LLM call as a Langfuse "generation" event.
//
// Parameters:
//   - traceID: unique ID for the parent trace (e.g. agent session ID)
//   - name: human-readable label (e.g. "react-loop-iteration-3")
//   - provider, model: LLM provider and model name
//   - prompt: the system + user messages (serialised)
//   - completion: the assistant response content
//   - inputTokens, outputTokens: usage counts
//   - latency: wall-clock duration of the LLM call
func (l *LangfuseClient) TraceGeneration(
	ctx context.Context,
	traceID, name, provider, model string,
	prompt, completion string,
	inputTokens, outputTokens int,
	latency time.Duration,
) {
	if !l.enabled {
		return
	}

	id := fmt.Sprintf("%s-gen-%d", traceID, time.Now().UnixNano())
	event := langfuseEvent{
		ID:        id,
		Type:      "generation-create",
		Timestamp: time.Now().UTC(),
		Body: map[string]any{
			"id":           id,
			"traceId":      traceID,
			"name":         name,
			"model":        model,
			"modelParameters": map[string]any{
				"provider": provider,
			},
			"input":  prompt,
			"output": completion,
			"usage": map[string]any{
				"input":  inputTokens,
				"output": outputTokens,
				"total":  inputTokens + outputTokens,
			},
			"startTime": time.Now().UTC().Add(-latency).Format(time.RFC3339Nano),
			"endTime":   time.Now().UTC().Format(time.RFC3339Nano),
		},
	}

	l.mu.Lock()
	l.batch = append(l.batch, event)
	ready := len(l.batch) >= 10 // flush every 10 events
	var toFlush []langfuseEvent
	if ready {
		toFlush = l.batch
		l.batch = nil
	}
	l.mu.Unlock()

	if ready {
		go l.flush(ctx, toFlush)
	}
}

// TraceSpan records a named span (e.g. a tool call or agent phase).
func (l *LangfuseClient) TraceSpan(
	ctx context.Context,
	traceID, name, input, output string,
	latency time.Duration,
	metadata map[string]any,
) {
	if !l.enabled {
		return
	}

	id := fmt.Sprintf("%s-span-%d", traceID, time.Now().UnixNano())
	body := map[string]any{
		"id":        id,
		"traceId":   traceID,
		"name":      name,
		"input":     input,
		"output":    output,
		"startTime": time.Now().UTC().Add(-latency).Format(time.RFC3339Nano),
		"endTime":   time.Now().UTC().Format(time.RFC3339Nano),
	}
	if metadata != nil {
		body["metadata"] = metadata
	}

	event := langfuseEvent{
		ID:        id,
		Type:      "span-create",
		Timestamp: time.Now().UTC(),
		Body:      body,
	}

	l.mu.Lock()
	l.batch = append(l.batch, event)
	ready := len(l.batch) >= 10
	var toFlush []langfuseEvent
	if ready {
		toFlush = l.batch
		l.batch = nil
	}
	l.mu.Unlock()

	if ready {
		go l.flush(ctx, toFlush)
	}
}

// Flush forces any buffered events to be sent immediately.
// Call this on graceful shutdown.
func (l *LangfuseClient) Flush(ctx context.Context) {
	if !l.enabled {
		return
	}
	l.mu.Lock()
	toFlush := l.batch
	l.batch = nil
	l.mu.Unlock()
	if len(toFlush) > 0 {
		l.flush(ctx, toFlush)
	}
}

func (l *LangfuseClient) flush(ctx context.Context, events []langfuseEvent) {
	payload := langfuseBatch{Batch: events}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		l.baseURL+"/api/public/ingestion", bytes.NewReader(data))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+l.authToken)

	resp, err := l.http.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}
