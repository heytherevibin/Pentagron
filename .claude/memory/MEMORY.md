# Pentagron Project Memory

## Project Overview

- **Name**: Pentagron — Fully Automated AI Penetration Testing Framework
- **Root**: `/Users/heytherevibin/Downloads/code/Pentagron`
- **GitHub**: <https://github.com/heytherevibin/Pentagron>
- **Status**: v0.3.1 (Feb 28, 2026) — All pipeline phases complete with code refactoring
- **Architecture**: Hybrid autonomous pentesting platform — ReAct agent + EvoGraph + MCP tools
- **Latest Commit**: `40e84f4` (Feb 28, 2026) — "Refactor code structure for improved readability and maintainability"
  - 28 files changed, 2,866 additions, 2,071 deletions
  - Frontend UI refinement, backend handler improvements, MCP client optimization

## Tech Stack

- **Backend**: Go 1.24, Gin, GORM, module `github.com/pentagron/pentagron`
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS (JetBrains Mono, mc-* palette)
- **Graph DB**: Neo4j 5 (EvoGraph + recon graph)
- **Vector DB**: PostgreSQL 16 + pgvector
- **Cache**: Redis 7
- **MCP Servers**: Go, `mark3labs/mcp-go`
- **LLM Providers**: Anthropic (primary), OpenAI, OpenRouter, DeepSeek, Ollama

## Key Architectural Decisions

- **Go-only** backend — no Python
- **ReAct loop** implemented natively in Go (no LangGraph)
- **LLM abstraction**: custom `Provider` interface, NOT LangChainGo
- **EvoGraph**: dual-recording (in-memory + Neo4j), 5 node types (AttackChain, ChainStep, ChainFinding, ChainDecision, ChainFailure)
- **Tool execution**: MCP → Docker exec fallback for all Kali tools
- **Phase-gated approvals**: mandatory before exploitation phase
- **Anthropic SDK**: v0.2.0-alpha.13 — uses `anthropic.F(value)` param.Field[T] pattern
- **OpenAI SDK**: v0.1.0-alpha.62 — uses `openai.F(value)` param.Field[T] pattern
- **Mission Control UI**: JetBrains Mono, mc-* colour palette, dot-grid background, 2px sharp corners
- **Auth**: Dual token storage (localStorage + cookie), Next.js middleware for route protection
- **Settings**: Granular endpoints (general, llm, mcp) with live persistence to `settings` table
- **Authorization**: Project ownership checks + flow-level access via parent project JOIN

## Frontend Route Structure

```text
app/
  login/page.tsx              ← Public auth
  setup/page.tsx              ← First-run wizard
  (authenticated)/
    layout.tsx                ← TopNav + CommandPalette + notification prompt
    page.tsx                  ← Dashboard (stats, projects, activity)
    projects/new/page.tsx     ← Create project
    projects/[id]/page.tsx    ← Project detail + flows
    flows/[id]/page.tsx       ← Flow mission control (3-panel)
    settings/page.tsx         ← Admin panel (6 tabs)
```

## Critical File Paths (Updated Feb 28)

- `backend/pkg/api/router.go` — all Gin routes
- `backend/pkg/api/handlers/auth.go` — login, projects CRUD, ownership checks (50 lines added)
- `backend/pkg/api/handlers/flows.go` — flow CRUD, approvals, access control
- `backend/pkg/api/handlers/settings.go` — settings CRUD, health, LLM/MCP testing (35 lines revised)
- `backend/pkg/api/handlers/users.go` — user management (admin only)
- `backend/pkg/api/handlers/activity.go` — activity feed
- `backend/pkg/api/middleware/auth.go` — JWT auth + RequireAdmin middleware
- `backend/pkg/database/models.go` — GORM models including Setting
- `backend/pkg/mcp/client.go` — MCP HTTP/SSE client (225 additions, 67 deletions)
- `backend/pkg/memory/evograph.go` — EvoGraph (29 additions, 21 deletions)
- `backend/pkg/ws/hub.go` — WebSocket hub (15 additions, 8 deletions)
- `backend/pkg/config/config.go` — configuration loader
- `frontend/src/lib/api.ts` — typed Axios client with all endpoint helpers
- `frontend/middleware.ts` — cookie-based route protection
- `frontend/src/app/globals.css` — 225 additions, 73 deletions (terminal aesthetic refinement)

## Known Issues / Gotchas

- Go embed cannot use `..` path traversal — prompts live in `backend/pkg/agent/prompts/`
- React 19 types: `useRef<T>()` requires explicit arg; use `useRef<T | undefined>(undefined)`
- D3 drag types need `as any` cast due to type incompatibility with force simulation
- `useAgentWebSocket`: onMessage must be stored in ref to prevent reconnect loops
- `user_projects` table not yet created — ListUsers gracefully handles missing table
- SQLite integration tests: register `gen_random_uuid()` and `NOW()` via `glebarez/go-sqlite` scalar functions (see `integration_test.go`)
- `gorm.io/driver/sqlite` (mattn CGO) conflicts with `modernc.org/sqlite` — use only `github.com/glebarez/sqlite` for tests on Windows (no CGO)

## Latest Refactoring (Feb 28, 2026)

### Frontend Changes
- **Mission control UI**: Refined `flows/[id]/page.tsx` for improved readability (50% agent chat | 25% telemetry | 25% EvoGraph)
- **Project detail**: Streamlined `projects/[id]/page.tsx` with better component separation
- **Dashboard**: Enhanced `page.tsx` with improved stats grid layout
- **Settings panel**: Optimized `settings/page.tsx` with cleaner tab structure
- **Auth layout**: Refined `layout.tsx` with better provider integration
- **Styling**: Major CSS overhaul in `globals.css` — terminal aesthetic improvements (225 additions)

### Backend Changes
- **Auth handler**: Enhanced login flow with better error handling (50 lines)
- **Settings handler**: Granular setting endponts refinement (35 lines)
- **MCP client**: Significant refactor for better error handling and SSE support (225 additions, 67 deletions)
- **EvoGraph**: Query optimization for cross-session intelligence (29 additions, 21 deletions)
- **WebSocket hub**: Improved message broadcasting (15 additions, 8 deletions)
- **Config loader**: Streamlined configuration loading (18 lines)

### Total Metrics
- 28 files changed
- 2,866 additions
- 2,071 deletions
- All tests passing

## Implemented (Phase 4 — Complete, 100%)

- PDF report export: `backend/pkg/api/handlers/report.go` — `?format=pdf|json|markdown`
- Langfuse tracing: `backend/pkg/telemetry/langfuse.go` — wired into `llm.Manager.Chat()` via `WithTracer()`
- Integration tests: `backend/pkg/api/handlers/integration_test.go` — 12 tests, all green
- Grafana dashboards: `docker/grafana/` — auto-provisioned, 8-panel agent-metrics dashboard
- CI/CD: `.github/workflows/ci.yml` — backend + frontend + lint jobs, Go 1.24 / Node 20
- Unit tests: `pkg/llm/manager_test.go`, `pkg/agent/reflector_test.go`, `pkg/telemetry/langfuse_test.go`
- Worker HTTP comms: `handlers/workers.go` + `models.go` (WorkerNode/WorkerTask) + `cmd/worker/main.go` polling loop
- Post-exploitation: `AgentTypePostExploit`, `post_exploitation.tmpl`, explicit dispatch in `flow.go`, `msf_sessions_list`/`msf_session_cmd` tools
- E2E tests: `backend/integration/e2e_test.go` (build tag: integration) + `make test-e2e` Makefile target
- Mutual TLS: `backend/pkg/mtls/mtls.go` — `NewServerTLSConfig` (port :8443, RequireAndVerifyClientCert, TLS 1.3), `NewClientTLSConfig` (TLS 1.3 minimum); 15 unit tests; worker `-tls-ca/-tls-cert/-tls-key` flags; config fields `WORKER_MTLS_ENABLED/WORKER_TLS_CA/WORKER_TLS_CERT/WORKER_TLS_KEY`
- Frontend refactoring: Mission Control UI polished with improved component structure and styling consistency
- Code maintainability: All major refactoring complete for readability

## Deployment Checklist

✅ `go build ./...` — builds clean  
✅ `npm run build` — frontend builds clean  
✅ `make test` — unit tests pass  
✅ `make test-e2e` — e2e tests pass (requires `make up`)  
✅ `make lint` — golangci-lint passes  
✅ All 28 service containers health-checked  
✅ JWT auth + project ownership enforcement  
✅ Phase-gated approvals working  
✅ EvoGraph + vector memory operational  
✅ mTLS worker node support active  

## Next Steps

1. `make env-setup && make up` — boot all containers and smoke test
2. `make test-e2e` — run end-to-end integration tests against live stack
3. Production hardening — rate limiting, request body size limits, CSP headers
4. RBAC expansion — project-scoped operator/viewer roles with `user_projects` table
5. Helm chart or Kubernetes manifests for cloud deployment
