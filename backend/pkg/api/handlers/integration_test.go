package handlers_test

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlitefunc "github.com/glebarez/go-sqlite"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/pentagron/pentagron/pkg/api"
	"github.com/pentagron/pentagron/pkg/api/handlers"
	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/flow"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"github.com/pentagron/pentagron/pkg/ws"
)

func init() {
	// Register PostgreSQL-compatible functions for SQLite in-memory test DB.
	sqlitefunc.MustRegisterDeterministicScalarFunction(
		"gen_random_uuid", 0,
		func(_ *sqlitefunc.FunctionContext, _ []driver.Value) (driver.Value, error) {
			return uuid.NewString(), nil
		},
	)
	sqlitefunc.MustRegisterScalarFunction(
		"NOW", 0,
		func(_ *sqlitefunc.FunctionContext, _ []driver.Value) (driver.Value, error) {
			return time.Now().UTC().Format("2006-01-02 15:04:05"), nil
		},
	)
}

// ── Test helpers ──────────────────────────────────────────────────────────────

const testJWTSecret = "test-secret-do-not-use-in-prod"

// setupTestDB creates an in-memory SQLite database with the minimal schema
// needed to exercise the API handlers.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	// Minimal DDL — mirrors PostgreSQL models but uses SQLite-compatible types
	stmts := []string{
		`CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'operator',
			deleted_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			scope TEXT,
			owner_id TEXT NOT NULL,
			deleted_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE flows (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			name TEXT NOT NULL,
			objective TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			phase TEXT NOT NULL DEFAULT 'recon',
			attack_path TEXT,
			started_at DATETIME,
			completed_at DATETIME,
			deleted_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE tasks (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			agent_type TEXT,
			status TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE actions (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			type TEXT,
			tool_name TEXT,
			input TEXT,
			output TEXT,
			success INTEGER,
			duration_ms INTEGER,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE artifacts (
			id TEXT PRIMARY KEY,
			action_id TEXT NOT NULL,
			name TEXT,
			type TEXT,
			value TEXT,
			severity TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE approval_requests (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			phase TEXT,
			description TEXT,
			payload TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			reviewed_by TEXT,
			reviewed_at DATETIME,
			notes TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE settings (
			key TEXT PRIMARY KEY,
			value TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
	}

	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("schema: %v", err)
		}
	}
	return db
}

// seedAdmin inserts a bcrypt-hashed admin user and returns its ID.
// Password is "password" for all tests (bcrypt pre-computed).
func seedAdmin(t *testing.T, db *gorm.DB) string {
	t.Helper()
	// bcrypt of "password" with cost 10 — pre-computed to keep tests fast
	hash := "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"
	id := "admin-test-uuid-0001"
	if err := db.Exec(
		`INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', datetime('now'), datetime('now'))`,
		id, "admin@test.local", hash,
	).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	return id
}

// makeToken generates a signed JWT for the given user.
func makeToken(t *testing.T, userID, email, role string) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   userID,
		"email": email,
		"role":  role,
		"exp":   time.Now().Add(time.Hour).Unix(),
	})
	str, err := tok.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return str
}

// setupRouter wires up the real Gin router with a test DB and stub dependencies.
func setupRouter(t *testing.T, db *gorm.DB) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		JWTSecret: testJWTSecret,
		GinMode:   "test",
	}

	// Stub FlowEngine — just satisfies the interface; no goroutines spawned
	flowEngine := &flow.FlowEngine{}

	hub := ws.NewHub(zap.NewNop())

	deps := &handlers.Deps{
		Config:     cfg,
		DB:         db,
		LLMMgr:     llm.NewManager(zap.NewNop()),
		MCPMgr:     mcp.NewManager(zap.NewNop()),
		FlowEngine: flowEngine,
		Hub:        hub,
		Log:        zap.NewNop(),
	}

	return api.Setup(deps, hub, "*", zap.NewNop())
}

// do is a convenience wrapper for httptest requests.
func do(r *gin.Engine, method, path, token string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// jsonBody unmarshals the recorder body into v and fails the test on error.
func jsonBody(t *testing.T, w *httptest.ResponseRecorder, v any) {
	t.Helper()
	if err := json.NewDecoder(w.Body).Decode(v); err != nil {
		t.Fatalf("decode response body: %v\nraw: %s", err, w.Body.String())
	}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func TestHealth(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db)

	w := do(r, http.MethodGet, "/health", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLogin_Success(t *testing.T) {
	db := setupTestDB(t)
	seedAdmin(t, db)
	r := setupRouter(t, db)

	w := do(r, http.MethodPost, "/api/auth/login", "", map[string]string{
		"email":    "admin@test.local",
		"password": "password",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	jsonBody(t, w, &resp)
	if resp["token"] == "" || resp["token"] == nil {
		t.Fatal("expected token in response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	db := setupTestDB(t)
	seedAdmin(t, db)
	r := setupRouter(t, db)

	w := do(r, http.MethodPost, "/api/auth/login", "", map[string]string{
		"email":    "admin@test.local",
		"password": "wrong",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", w.Code)
	}
}

func TestLogin_UnknownEmail(t *testing.T) {
	db := setupTestDB(t)
	seedAdmin(t, db)
	r := setupRouter(t, db)

	w := do(r, http.MethodPost, "/api/auth/login", "", map[string]string{
		"email":    "nobody@test.local",
		"password": "password",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", w.Code)
	}
}

func TestProtectedRoute_NoToken(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db)

	w := do(r, http.MethodGet, "/api/projects", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", w.Code)
	}
}

func TestProjectCRUD(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)
	tok := makeToken(t, adminID, "admin@test.local", "admin")

	// CREATE
	w := do(r, http.MethodPost, "/api/projects", tok, map[string]string{
		"name":        "Test Engagement",
		"description": "Integration test project",
		"scope":       "192.168.1.0/24",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: want 201, got %d: %s", w.Code, w.Body.String())
	}
	var created map[string]any
	jsonBody(t, w, &created)
	projectID, _ := created["id"].(string)
	if projectID == "" {
		t.Fatal("expected project id in response")
	}

	// LIST
	w = do(r, http.MethodGet, "/api/projects", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: want 200, got %d", w.Code)
	}
	var projects []map[string]any
	jsonBody(t, w, &projects)
	if len(projects) == 0 {
		t.Fatal("expected at least one project")
	}

	// GET
	w = do(r, http.MethodGet, "/api/projects/"+projectID, tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get: want 200, got %d: %s", w.Code, w.Body.String())
	}

	// DELETE
	w = do(r, http.MethodDelete, "/api/projects/"+projectID, tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: want 200, got %d", w.Code)
	}

	// Confirm gone
	w = do(r, http.MethodGet, "/api/projects/"+projectID, tok, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("after delete: want 404, got %d", w.Code)
	}
}

func TestFlowCRUD(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)
	tok := makeToken(t, adminID, "admin@test.local", "admin")

	// Create project first
	w := do(r, http.MethodPost, "/api/projects", tok, map[string]string{
		"name": "Flow Test Project",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create project: %d %s", w.Code, w.Body.String())
	}
	var proj map[string]any
	jsonBody(t, w, &proj)
	projectID := proj["id"].(string)

	// CREATE flow
	w = do(r, http.MethodPost, fmt.Sprintf("/api/projects/%s/flows", projectID), tok, map[string]string{
		"name":      "Test Flow",
		"objective": "Enumerate 192.168.1.1",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create flow: want 201, got %d: %s", w.Code, w.Body.String())
	}
	var flowResp map[string]any
	jsonBody(t, w, &flowResp)
	flowID, _ := flowResp["id"].(string)
	if flowID == "" {
		t.Fatal("expected flow id")
	}

	// LIST flows
	w = do(r, http.MethodGet, fmt.Sprintf("/api/projects/%s/flows", projectID), tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list flows: want 200, got %d", w.Code)
	}
	var flows []map[string]any
	jsonBody(t, w, &flows)
	if len(flows) == 0 {
		t.Fatal("expected at least one flow")
	}

	// GET flow
	w = do(r, http.MethodGet, "/api/flows/"+flowID, tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get flow: want 200, got %d: %s", w.Code, w.Body.String())
	}

	// DELETE flow
	w = do(r, http.MethodDelete, "/api/flows/"+flowID, tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete flow: want 200, got %d", w.Code)
	}
}

func TestFlowOwnershipIsolation(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)

	// Seed a second non-admin user directly
	otherID := "other-user-uuid-0002"
	otherHash := "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"
	db.Exec(`INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, 'other@test.local', ?, 'operator', datetime('now'), datetime('now'))`, otherID, otherHash)

	adminTok := makeToken(t, adminID, "admin@test.local", "admin")
	otherTok := makeToken(t, otherID, "other@test.local", "operator")

	// Admin creates project
	w := do(r, http.MethodPost, "/api/projects", adminTok, map[string]string{"name": "Admin Project"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create project: %d %s", w.Code, w.Body.String())
	}
	var proj map[string]any
	jsonBody(t, w, &proj)
	projectID, _ := proj["id"].(string)
	if projectID == "" {
		t.Fatalf("expected project id, got: %v", proj)
	}

	// Admin creates flow
	w = do(r, http.MethodPost, fmt.Sprintf("/api/projects/%s/flows", projectID), adminTok, map[string]string{
		"name":      "Admin Flow",
		"objective": "Test isolation",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create flow: %d %s", w.Code, w.Body.String())
	}
	var flowResp map[string]any
	jsonBody(t, w, &flowResp)
	flowID, _ := flowResp["id"].(string)
	if flowID == "" {
		t.Fatalf("expected flow id, got: %v", flowResp)
	}

	// Other user cannot access admin's flow
	w = do(r, http.MethodGet, "/api/flows/"+flowID, otherTok, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("ownership isolation: want 403, got %d", w.Code)
	}
}

func TestApprovalListEmpty(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)
	tok := makeToken(t, adminID, "admin@test.local", "admin")

	// Create project + flow
	w := do(r, http.MethodPost, "/api/projects", tok, map[string]string{"name": "P"})
	var proj map[string]any
	jsonBody(t, w, &proj)

	w = do(r, http.MethodPost, fmt.Sprintf("/api/projects/%s/flows", proj["id"]), tok, map[string]string{
		"name":      "F",
		"objective": "O",
	})
	var flowResp map[string]any
	jsonBody(t, w, &flowResp)
	flowID := flowResp["id"].(string)

	// List approvals — should be empty array, not error
	w = do(r, http.MethodGet, "/api/flows/"+flowID+"/approvals", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}
	var approvals []any
	jsonBody(t, w, &approvals)
	if approvals == nil {
		t.Fatal("expected empty slice, not nil")
	}
}

func TestReportMarkdown(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)
	tok := makeToken(t, adminID, "admin@test.local", "admin")

	// Seed project + flow directly
	projectID := "proj-report-test-0001"
	flowID := "flow-report-test-0001"
	db.Exec(`INSERT INTO projects (id, name, owner_id, created_at, updated_at) VALUES (?, 'Report Project', ?, datetime('now'), datetime('now'))`, projectID, adminID)
	db.Exec(`INSERT INTO flows (id, project_id, name, objective, status, phase, created_at, updated_at) VALUES (?, ?, 'Report Flow', 'Test objective', 'completed', 'reporting', datetime('now'), datetime('now'))`, flowID, projectID)

	w := do(r, http.MethodGet, "/api/flows/"+flowID+"/report", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("report: want 200, got %d: %s", w.Code, w.Body.String())
	}
	ct := w.Header().Get("Content-Type")
	if ct != "text/markdown; charset=utf-8" {
		t.Fatalf("expected markdown content-type, got %q", ct)
	}
	body := w.Body.String()
	if len(body) == 0 {
		t.Fatal("expected non-empty report body")
	}
	if body[:1] != "#" {
		t.Fatalf("expected markdown heading, body starts with: %q", body[:20])
	}
}

func TestReportPDF(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)
	tok := makeToken(t, adminID, "admin@test.local", "admin")

	projectID := "proj-pdf-test-0001"
	flowID := "flow-pdf-test-0001"
	db.Exec(`INSERT INTO projects (id, name, owner_id, created_at, updated_at) VALUES (?, 'PDF Project', ?, datetime('now'), datetime('now'))`, projectID, adminID)
	db.Exec(`INSERT INTO flows (id, project_id, name, objective, status, phase, created_at, updated_at) VALUES (?, ?, 'PDF Flow', 'Test PDF', 'completed', 'reporting', datetime('now'), datetime('now'))`, flowID, projectID)

	w := do(r, http.MethodGet, "/api/flows/"+flowID+"/report?format=pdf", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("pdf report: want 200, got %d: %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Type") != "application/pdf" {
		t.Fatalf("expected PDF content-type, got %q", w.Header().Get("Content-Type"))
	}
	// PDF magic bytes: %PDF
	if !bytes.HasPrefix(w.Body.Bytes(), []byte("%PDF")) {
		t.Fatalf("response is not a valid PDF (no %%PDF header)")
	}
}

func TestReportJSON(t *testing.T) {
	db := setupTestDB(t)
	adminID := seedAdmin(t, db)
	r := setupRouter(t, db)
	tok := makeToken(t, adminID, "admin@test.local", "admin")

	projectID := "proj-json-test-0001"
	flowID := "flow-json-test-0001"
	db.Exec(`INSERT INTO projects (id, name, owner_id, created_at, updated_at) VALUES (?, 'JSON Project', ?, datetime('now'), datetime('now'))`, projectID, adminID)
	db.Exec(`INSERT INTO flows (id, project_id, name, objective, status, phase, created_at, updated_at) VALUES (?, ?, 'JSON Flow', 'Test JSON', 'completed', 'reporting', datetime('now'), datetime('now'))`, flowID, projectID)

	w := do(r, http.MethodGet, "/api/flows/"+flowID+"/report?format=json", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("json report: want 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	jsonBody(t, w, &resp)
	if _, ok := resp["markdown"]; !ok {
		t.Fatal("expected 'markdown' field in JSON report")
	}
	if _, ok := resp["findings"]; !ok {
		t.Fatal("expected 'findings' field in JSON report")
	}
}
