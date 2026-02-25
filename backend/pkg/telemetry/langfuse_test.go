package telemetry

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// ── Disabled client (no-op) ───────────────────────────────────────────────────

func TestNewLangfuse_Disabled(t *testing.T) {
	c := NewLangfuse(false, "pk", "sk", "http://localhost:4000")
	if c.enabled {
		t.Error("expected client to be disabled")
	}
}

func TestNewLangfuse_MissingKeys(t *testing.T) {
	// enabled=true but missing keys → disabled
	c := NewLangfuse(true, "", "", "http://localhost:4000")
	if c.enabled {
		t.Error("expected client to be disabled when keys are empty")
	}
}

func TestNewLangfuse_Enabled(t *testing.T) {
	c := NewLangfuse(true, "pk-test", "sk-test", "http://localhost:4000")
	if !c.enabled {
		t.Error("expected client to be enabled")
	}
	if c.authToken == "" {
		t.Error("expected auth token to be set")
	}
}

func TestTraceGeneration_Disabled_NoOp(t *testing.T) {
	// Disabled client should never make HTTP calls — use a server that panics if hit
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("disabled client should not make HTTP calls")
	}))
	defer srv.Close()

	c := NewLangfuse(false, "pk", "sk", srv.URL)
	c.TraceGeneration(context.Background(), "trace1", "test", "anthropic", "claude-3", "prompt", "completion", 10, 5, time.Millisecond)
	// If we get here without the test panicking, the no-op worked
}

func TestTraceSpan_Disabled_NoOp(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("disabled client should not make HTTP calls")
	}))
	defer srv.Close()

	c := NewLangfuse(false, "pk", "sk", srv.URL)
	c.TraceSpan(context.Background(), "trace1", "tool-call", "input", "output", time.Millisecond, nil)
}

func TestFlush_Disabled_NoOp(t *testing.T) {
	c := NewLangfuse(false, "pk", "sk", "")
	// Should not panic
	c.Flush(context.Background())
}

// ── Batch accumulation ────────────────────────────────────────────────────────

func TestBatch_AccumulatesEvents(t *testing.T) {
	// Point at a server that accepts requests but we don't flush yet
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)

	// Add 5 events — should not trigger auto-flush (threshold is 10)
	for i := 0; i < 5; i++ {
		c.TraceGeneration(context.Background(), "t1", "gen", "anthropic", "claude", "p", "c", 1, 1, time.Millisecond)
	}

	c.mu.Lock()
	batchLen := len(c.batch)
	c.mu.Unlock()

	if batchLen != 5 {
		t.Errorf("expected 5 batched events, got %d", batchLen)
	}
}

// ── Auto-flush at threshold ───────────────────────────────────────────────────

func TestBatch_AutoFlushAt10(t *testing.T) {
	var mu sync.Mutex
	var receivedBatches []langfuseBatch

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var b langfuseBatch
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			t.Errorf("decode error: %v", err)
		}
		mu.Lock()
		receivedBatches = append(receivedBatches, b)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)

	// Add exactly 10 events → auto-flush triggered asynchronously
	for i := 0; i < 10; i++ {
		c.TraceGeneration(context.Background(), "t1", "gen", "anthropic", "claude", "p", "c", 1, 1, time.Millisecond)
	}

	// Give async goroutine time to complete
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(receivedBatches)
		mu.Unlock()
		if n >= 1 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	mu.Lock()
	n := len(receivedBatches)
	mu.Unlock()

	if n == 0 {
		t.Fatal("expected at least one HTTP batch to be sent at threshold=10")
	}
}

// ── Flush drains remaining events ─────────────────────────────────────────────

func TestFlush_DrainsBatch(t *testing.T) {
	var mu sync.Mutex
	var received []langfuseEvent

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var b langfuseBatch
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			t.Errorf("decode error: %v", err)
		}
		mu.Lock()
		received = append(received, b.Batch...)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)

	// Add 3 events (below threshold)
	for i := 0; i < 3; i++ {
		c.TraceSpan(context.Background(), "t2", "span", "in", "out", time.Millisecond, nil)
	}

	c.Flush(context.Background())

	mu.Lock()
	n := len(received)
	mu.Unlock()

	if n != 3 {
		t.Errorf("expected 3 flushed events, got %d", n)
	}
}

func TestFlush_EmptyBatch_NoHTTPCall(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)
	c.Flush(context.Background()) // batch is empty

	if called {
		t.Error("Flush with empty batch should not make HTTP calls")
	}
}

// ── Authorization header ──────────────────────────────────────────────────────

func TestFlush_SetsAuthHeader(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)
	c.TraceSpan(context.Background(), "t3", "span", "in", "out", time.Millisecond, nil)
	c.Flush(context.Background())

	if gotAuth == "" {
		t.Fatal("expected Authorization header to be set")
	}
	if len(gotAuth) < 6 || gotAuth[:6] != "Basic " {
		t.Errorf("expected Basic auth, got %q", gotAuth)
	}
}

// ── TraceSpan with metadata ───────────────────────────────────────────────────

func TestTraceSpan_WithMetadata(t *testing.T) {
	var received langfuseBatch
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)
	c.TraceSpan(context.Background(), "t4", "tool-exec", "nmap -sV", "open:80,443", time.Second,
		map[string]any{"tool": "nmap", "exitCode": 0})
	c.Flush(context.Background())

	if len(received.Batch) == 0 {
		t.Fatal("expected at least one event")
	}
	evt := received.Batch[0]
	if evt.Type != "span-create" {
		t.Errorf("expected type span-create, got %s", evt.Type)
	}
	if evt.Body["name"] != "tool-exec" {
		t.Errorf("expected name tool-exec, got %v", evt.Body["name"])
	}
	meta, ok := evt.Body["metadata"].(map[string]any)
	if !ok {
		t.Fatal("expected metadata map in body")
	}
	if meta["tool"] != "nmap" {
		t.Errorf("expected metadata.tool=nmap, got %v", meta["tool"])
	}
}

// ── Concurrent safety ─────────────────────────────────────────────────────────

func TestConcurrent_TraceGeneration(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewLangfuse(true, "pk-test", "sk-test", srv.URL)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.TraceGeneration(context.Background(), "concurrent", "gen", "p", "m", "prompt", "resp", 1, 1, time.Millisecond)
		}()
	}
	wg.Wait()
	c.Flush(context.Background())
	// If no race detector errors, concurrent safety is confirmed
}
