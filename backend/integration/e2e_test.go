//go:build integration

// Package integration contains end-to-end tests that require a live Pentagron
// stack (Postgres, Redis, Neo4j).
//
// Prerequisites:
//
//	make up   # boot all containers
//
// Run:
//
//	make test-e2e
//	# or directly:
//	go test -tags=integration ./backend/integration/... -v -timeout=120s
//
// Environment variables (defaults assume docker-compose stack):
//
//	PENTAGRON_E2E_URL      — base URL of the API server (default: http://localhost:8080)
//	PENTAGRON_E2E_EMAIL    — admin user email     (default: admin@pentagron.local)
//	PENTAGRON_E2E_PASSWORD — admin user password  (default: changeme)
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// ── Config ────────────────────────────────────────────────────────────────────

func baseURL() string {
	if v := os.Getenv("PENTAGRON_E2E_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://localhost:8080"
}

func adminEmail() string {
	if v := os.Getenv("PENTAGRON_E2E_EMAIL"); v != "" {
		return v
	}
	return "admin@pentagron.local"
}

func adminPassword() string {
	if v := os.Getenv("PENTAGRON_E2E_PASSWORD"); v != "" {
		return v
	}
	return "changeme"
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

type e2eClient struct {
	base  string
	token string
	http  *http.Client
}

func newClient(base string) *e2eClient {
	return &e2eClient{
		base: base,
		http: &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *e2eClient) do(method, path string, body any) (*http.Response, []byte, error) {
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, nil, err
		}
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(context.Background(), method, c.base+path, r)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp, raw, nil
}

func decode(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("decode JSON: %v — body: %s", err, string(raw))
	}
	return m
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// TestE2E_Health verifies the server is up before running any other tests.
func TestE2E_Health(t *testing.T) {
	c := newClient(baseURL())
	resp, body, err := c.do("GET", "/health", nil)
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", resp.StatusCode, body)
	}
	m := decode(t, body)
	if m["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", m["status"])
	}
}

// TestE2E_Login verifies JWT auth flow end-to-end.
func TestE2E_Login(t *testing.T) {
	c := newClient(baseURL())
	resp, body, err := c.do("POST", "/api/auth/login", map[string]string{
		"email":    adminEmail(),
		"password": adminPassword(),
	})
	if err != nil {
		t.Fatalf("POST /api/auth/login: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", resp.StatusCode, body)
	}
	m := decode(t, body)
	token, _ := m["token"].(string)
	if token == "" {
		t.Fatalf("expected token in response, got: %v", m)
	}
}

// TestE2E_ProjectFlowLifecycle is the core end-to-end scenario:
// login → create project → create flow → start flow → verify running → cancel.
func TestE2E_ProjectFlowLifecycle(t *testing.T) {
	c := newClient(baseURL())

	// ── Step 1: Login ─────────────────────────────────────────────────────────
	resp, body, err := c.do("POST", "/api/auth/login", map[string]string{
		"email":    adminEmail(),
		"password": adminPassword(),
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login failed %d: %s", resp.StatusCode, body)
	}
	m := decode(t, body)
	c.token = m["token"].(string)

	// ── Step 2: Create project ────────────────────────────────────────────────
	resp, body, err = c.do("POST", "/api/projects", map[string]string{
		"name":        "E2E Test Project",
		"description": "Created by integration test",
		"scope":       "192.168.0.0/24",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project %d: %s", resp.StatusCode, body)
	}
	proj := decode(t, body)
	projectID, ok := proj["id"].(string)
	if !ok || projectID == "" {
		t.Fatalf("expected project id, got: %v", proj)
	}
	t.Logf("created project id=%s", projectID)

	// Cleanup: delete project at end
	defer func() {
		_, _, _ = c.do("DELETE", "/api/projects/"+projectID, nil)
	}()

	// ── Step 3: Create flow ───────────────────────────────────────────────────
	resp, body, err = c.do("POST", fmt.Sprintf("/api/projects/%s/flows", projectID), map[string]string{
		"name":      "E2E Test Flow",
		"objective": "Integration test — enumerate hosts on 192.168.0.0/24",
	})
	if err != nil {
		t.Fatalf("create flow: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create flow %d: %s", resp.StatusCode, body)
	}
	fl := decode(t, body)
	flowID, ok := fl["id"].(string)
	if !ok || flowID == "" {
		t.Fatalf("expected flow id, got: %v", fl)
	}
	t.Logf("created flow id=%s", flowID)

	// ── Step 4: Get flow — should be pending ──────────────────────────────────
	resp, body, err = c.do("GET", "/api/flows/"+flowID, nil)
	if err != nil {
		t.Fatalf("get flow: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("get flow %d: %s", resp.StatusCode, body)
	}
	fl = decode(t, body)
	if status := fl["status"]; status != "pending" {
		t.Errorf("expected status=pending, got %v", status)
	}

	// ── Step 5: Start flow ────────────────────────────────────────────────────
	resp, body, err = c.do("POST", "/api/flows/"+flowID+"/start", nil)
	if err != nil {
		t.Fatalf("start flow: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("start flow %d: %s", resp.StatusCode, body)
	}

	// ── Step 6: Poll until running or paused (up to 15s) ─────────────────────
	var finalStatus string
	for i := 0; i < 15; i++ {
		time.Sleep(time.Second)
		resp, body, err = c.do("GET", "/api/flows/"+flowID, nil)
		if err != nil {
			t.Logf("poll flow: %v (attempt %d)", err, i+1)
			continue
		}
		fl = decode(t, body)
		s, _ := fl["status"].(string)
		t.Logf("flow status after %ds: %s", i+1, s)
		if s == "running" || s == "paused" || s == "completed" || s == "failed" {
			finalStatus = s
			break
		}
	}
	if finalStatus == "" {
		t.Fatalf("flow never left pending state in 15s")
	}
	t.Logf("flow reached status=%s", finalStatus)

	// ── Step 7: Cancel the flow ───────────────────────────────────────────────
	resp, body, err = c.do("POST", "/api/flows/"+flowID+"/cancel", nil)
	if err != nil {
		t.Fatalf("cancel flow: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("cancel flow %d: %s", resp.StatusCode, body)
	}

	// ── Step 8: Verify cancelled ──────────────────────────────────────────────
	time.Sleep(500 * time.Millisecond)
	resp, body, err = c.do("GET", "/api/flows/"+flowID, nil)
	if err != nil {
		t.Fatalf("get flow post-cancel: %v", err)
	}
	fl = decode(t, body)
	if s := fl["status"]; s != "cancelled" && s != "completed" {
		t.Errorf("expected cancelled or completed after cancel, got %v", s)
	}
}

// TestE2E_ReportMarkdown verifies the markdown report endpoint for a flow.
func TestE2E_ReportMarkdown(t *testing.T) {
	c := newClient(baseURL())

	// Login
	_, body, err := c.do("POST", "/api/auth/login", map[string]string{
		"email":    adminEmail(),
		"password": adminPassword(),
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	m := decode(t, body)
	c.token = m["token"].(string)

	// Create project + flow
	_, body, _ = c.do("POST", "/api/projects", map[string]string{
		"name": "E2E Report Test", "scope": "10.0.0.1",
	})
	proj := decode(t, body)
	projectID, _ := proj["id"].(string)
	defer func() { _, _, _ = c.do("DELETE", "/api/projects/"+projectID, nil) }()

	_, body, _ = c.do("POST", "/api/projects/"+projectID+"/flows", map[string]string{
		"name": "Report Flow", "objective": "test",
	})
	fl := decode(t, body)
	flowID, _ := fl["id"].(string)

	// Request markdown report
	resp, body, err := c.do("GET", "/api/flows/"+flowID+"/report?format=markdown", nil)
	if err != nil {
		t.Fatalf("GET report: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("report %d: %s", resp.StatusCode, body)
	}
	ct := resp.Header.Get("Content-Type")
	if !strings.Contains(ct, "text/markdown") && !strings.Contains(ct, "text/plain") {
		t.Errorf("unexpected Content-Type: %s", ct)
	}
}

// TestE2E_ReportPDF verifies that the PDF export returns valid PDF bytes.
func TestE2E_ReportPDF(t *testing.T) {
	c := newClient(baseURL())

	_, body, _ := c.do("POST", "/api/auth/login", map[string]string{
		"email": adminEmail(), "password": adminPassword(),
	})
	m := decode(t, body)
	c.token = m["token"].(string)

	_, body, _ = c.do("POST", "/api/projects", map[string]string{
		"name": "E2E PDF Test", "scope": "10.0.0.2",
	})
	proj := decode(t, body)
	projectID, _ := proj["id"].(string)
	defer func() { _, _, _ = c.do("DELETE", "/api/projects/"+projectID, nil) }()

	_, body, _ = c.do("POST", "/api/projects/"+projectID+"/flows", map[string]string{
		"name": "PDF Flow", "objective": "test",
	})
	fl := decode(t, body)
	flowID, _ := fl["id"].(string)

	resp, body, err := c.do("GET", "/api/flows/"+flowID+"/report?format=pdf", nil)
	if err != nil {
		t.Fatalf("GET pdf report: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("pdf report %d: %s", resp.StatusCode, body)
	}
	// PDF magic bytes: %PDF-
	if len(body) < 5 || string(body[:5]) != "%PDF-" {
		t.Errorf("expected PDF magic bytes, got: %q", string(body[:min(20, len(body))]))
	}
}

// TestE2E_WorkerRegister verifies the worker registration endpoint accepts a worker node.
func TestE2E_WorkerRegister(t *testing.T) {
	c := newClient(baseURL())

	_, body, _ := c.do("POST", "/api/auth/login", map[string]string{
		"email": adminEmail(), "password": adminPassword(),
	})
	m := decode(t, body)
	c.token = m["token"].(string)

	workerID := fmt.Sprintf("e2e-worker-%d", time.Now().Unix())
	resp, body, err := c.do("POST", "/api/workers/register", map[string]any{
		"id":           workerID,
		"hostname":     "e2e-test-host",
		"capabilities": []string{"naabu", "nuclei"},
	})
	if err != nil {
		t.Fatalf("register worker: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("register worker %d: %s", resp.StatusCode, body)
	}
	result := decode(t, body)
	if result["worker_id"] != workerID {
		t.Errorf("expected worker_id=%s, got %v", workerID, result["worker_id"])
	}

	// Poll — should return nil task since none assigned
	resp, body, err = c.do("GET", "/api/workers/"+workerID+"/tasks", nil)
	if err != nil {
		t.Fatalf("poll worker tasks: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("poll tasks %d: %s", resp.StatusCode, body)
	}
	poll := decode(t, body)
	if poll["task"] != nil {
		t.Errorf("expected nil task for fresh worker, got %v", poll["task"])
	}
}

// min returns the smaller of a and b.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
