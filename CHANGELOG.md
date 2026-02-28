# Changelog

All notable changes to Pentagron are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.3.0] - 2026-02-25

### Added

#### Observability
- **Langfuse tracing** (`backend/pkg/telemetry/langfuse.go`) — lightweight HTTP batch client posting generation/span events to Langfuse ingestion API v2. Activated via `LANGFUSE_ENABLED=true`. Buffered (10 events), async goroutine flush, graceful drain on shutdown
- **LLM tracing** — every `llm.Manager.Chat()` call automatically records a Langfuse generation event with provider, model, prompt snippet (≤2KB), completion, token counts, and latency. Wired via `manager.WithTracer()`
- **Grafana provisioning** (`docker/grafana/`) — datasource YAML and dashboard provider auto-loaded on container start; no manual import required
- **Grafana agent-metrics dashboard** (`docker/grafana/dashboards/agent-metrics.json`) — 8 panels: total/active/completed flows, critical findings (24h), pending approvals, tool calls (24h), flows per hour (bar chart), flow status distribution (pie), tool calls per hour by tool (time series), tool performance table (avg/max latency + success %), findings by severity (pie + time series), recent flows table
- **Grafana volume mounts** — `docker-compose.observability.yml` now mounts `./docker/grafana/provisioning` and `./docker/grafana/dashboards` read-only into the container

#### Reports
- **PDF report export** — `GET /api/flows/:id/report?format=pdf` returns a branded A4 PDF (`github.com/jung-kurt/gofpdf`). Dark theme with emerald Pentagron header, severity-colour-coded findings table (critical=red, high=orange, medium=yellow, low=green), tool timeline with PASS/FAIL colour coding, confidentiality footer with page numbers
- **JSON report format** — `?format=json` returns structured `{flow, findings, actions, markdown}` object alongside the markdown string
- Report endpoint now supports three formats via `?format=pdf|json|markdown` (markdown is the default)

#### EvoGraph
- **EvoGraph read API** (`GET /api/flows/:id/graph`) — executes real Neo4j Cypher queries (`MATCH (c:AttackChain)-[r:HAS_NODE]->(n)`), returns D3-compatible `{nodes, edges}` JSON for real-time graph visualisation in Mission Control

#### Testing
- **Handler integration tests** (`backend/pkg/api/handlers/integration_test.go`) — 12 tests, all passing. Uses `github.com/glebarez/sqlite` (pure-Go, no CGO) in-memory DB with `gen_random_uuid()` and `NOW()` registered as SQLite scalar functions to match PostgreSQL raw SQL. Covers: health, login success/wrong-password/unknown-email, auth guard, project CRUD, flow CRUD, ownership isolation (403 enforcement), approval list, report in all three formats (markdown/PDF/JSON)

#### CI/CD
- **GitHub Actions** (`.github/workflows/ci.yml`) — triggers on push and PR to `main`. Three parallel jobs: `backend` (`go build + go test -race`), `frontend` (`npm ci + next build + eslint`), `lint` (`golangci-lint`). Go 1.24 + Node 20, module/npm cache, SQLite CGO-free test environment

#### Unit Tests
- **`pkg/llm/manager_test.go`** — fallback chain routing, provider registration order, prompt snippet truncation
- **`pkg/agent/reflector_test.go`** — free-text drift detection, redirect message construction, tool-call passthrough
- **`pkg/telemetry/langfuse_test.go`** — disabled no-op (zero HTTP calls), batch accumulation, flush behaviour

#### Worker Node
- **Worker HTTP registration** — worker announces itself to the main server on startup (`POST /api/workers/register`) with ID, hostname, capabilities list, and tool inventory
- **Task polling** — worker long-polls for pending tool tasks (`GET /api/workers/:id/tasks`, 5 s interval); executes via existing `tools.Executor`; posts results back (`POST /api/workers/:id/results`)
- **Worker API handlers** (`backend/pkg/api/handlers/workers.go`) — `RegisterWorker`, `PollWorkerTasks`, `SubmitWorkerResult`
- **WorkerNode + WorkerTask models** (`backend/pkg/database/models.go`) — GORM models with status tracking and result storage
- **New routes in router** — worker endpoints under `/api/workers/`

#### Post-Exploitation Phase
- **Post-exploitation agent** — explicit phase dispatch in `flow.go` for `"post_exploitation"`. Uses dedicated `AgentTypePostExploit` with tools: `shell`, `msf_session_cmd`, `msf_sessions_list`. Auto-runs after exploitation approval (no second gate)
- **Post-exploitation prompt template** (`backend/pkg/agent/prompts/post_exploitation.tmpl`) — structured objectives: enumerate active sessions, attempt privilege escalation, harvest credentials (LSASS, SAM, /etc/shadow), establish persistence, lateral movement enumeration

#### Air-gapped Worker Mutual TLS

- **`pkg/mtls` package** (`backend/pkg/mtls/mtls.go`) — `NewServerTLSConfig` (RequireAndVerifyClientCert, TLS 1.3 minimum), `NewClientTLSConfig` (RootCAs pool, TLS 1.3 minimum), `loadCertPool` (PEM CA file → `*x509.CertPool`), `IsEnabled` guard
- **Config fields** — four new env vars: `WORKER_MTLS_ENABLED` (bool, default false), `WORKER_TLS_CA`, `WORKER_TLS_CERT`, `WORKER_TLS_KEY` (all default empty)
- **Server mTLS listener** — when `WORKER_MTLS_ENABLED=true` and all cert paths are set, the server starts a second `*http.Server` on `:8443` with the mTLS `tls.Config`; uses `ListenAndServeTLS("","")` (certs embedded in `TLSConfig`); graceful shutdown included
- **Worker mTLS client** — `-tls-ca`, `-tls-cert`, `-tls-key` CLI flags on `cmd/worker`; `buildHTTPClient()` returns a plain or mTLS-wrapped `*http.Client` depending on whether paths are set
- **Unit tests** (`backend/pkg/mtls/mtls_test.go`) — 15 tests: `IsEnabled` (5 cases), `NewServerTLSConfig` valid/bad paths, `NewClientTLSConfig` valid/bad, `loadCertPool` valid/nonexistent/invalidPEM, TLS 1.3 minimum enforcement for both server and client; uses in-process ECDSA P-256 cert generation (no openssl required)

### Changed
- `Makefile` — added `test-e2e` target: `go test -tags=integration -timeout=120s ./backend/integration/...`
- `Makefile` — updated `test` target description to reflect integration test separation
- `docker-compose.observability.yml` — added Grafana provisioning volume mounts and `GF_PATHS_PROVISIONING` / `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH` env vars

---

## [0.2.0] - 2026-02-25

### Added

#### Frontend — Mission Control UI Rebuild
- **Design system**: JetBrains Mono font, `mc-*` colour palette (emerald primary, crimson danger), dot-grid background, 2px sharp corners, custom scrollbars
- **PostCSS config**: Created `postcss.config.mjs` — fixes zero-style rendering
- **Auth middleware**: `frontend/middleware.ts` — cookie-based route protection, redirect to `/login` with return URL
- **Route groups**: `(authenticated)/` layout with TopNav + CommandPalette wrapper
- **17 UI components**: GlowDot, DataLabel, Panel, StatusBadge, Button, Input, Textarea, TagInput, StatCard, PhaseProgress, TopNav, EmptyState, ConfirmDialog, CommandPalette, Skeleton, SlidePanel, FlowTicker
- **Login page**: Centered card with system health check, dual token storage (localStorage + cookie), Suspense boundary for `useSearchParams`
- **Setup wizard**: 3-step onboarding (API key → first project → first flow) at `/setup`
- **Dashboard**: 4 StatCards, active engagements table, recent activity feed from `GET /api/activity`
- **Create project page**: `/projects/new` with TagInput for scope validation
- **Project detail page**: Project info panel + flows table with inline "new flow" form + ConfirmDialog for deletes
- **Flow execution page**: 3-panel mission control (50% agent chat | 25% telemetry | 25% EvoGraph), phase progress bar, approval dialog
- **Settings admin panel**: 6-tab layout (General, LLM, Agents, MCP, Users, Health) with live API persistence, masked API key inputs, connection testing, user management
- **AgentChat**: Collapsible thoughts, tool calls with input/output toggle, emerald/crimson result accents, auto-scroll with floating button, connection GlowDot
- **GraphVisualization**: D3 force-directed graph with SVG glow filters, colour-coded nodes by type, click navigation
- **ApprovalDialog**: Amber-accented professional dialog with AUTHORIZE/DENY buttons and optional notes
- **Command palette**: Cmd+K global search across projects, flows, pages, and quick actions
- **Report export**: "EXPORT REPORT" button on completed/failed flows, client-side Markdown generation with download
- **Browser notifications**: Permission prompt on first authenticated load, notification trigger for pending approvals when tab is hidden
- **PWA support**: `manifest.json`, service worker (`sw.js`) with cache-first static + network-first API, SVG pentagon icons, offline shell

#### Backend — New Endpoints
- `GET /api/settings/general` + `PUT /api/settings/general` — runtime general config
- `GET /api/settings/llm` + `PUT /api/settings/llm` — per-provider LLM config with masked keys
- `POST /api/settings/llm/test` — test LLM provider connectivity with latency
- `GET /api/settings/mcp` + `PUT /api/settings/mcp` — MCP server URL management
- `POST /api/settings/mcp/test` — test MCP server connectivity
- `GET /api/users` + `POST /api/users` — user listing and creation (admin only)
- `PUT /api/users/:user_id` + `DELETE /api/users/:user_id` — user role update and deactivation
- `POST /api/users/:user_id/reset-password` — admin password reset
- `GET /api/activity` — recent activity feed (joins flows + projects)
- `GET /api/health/all` — aggregate health (LLM + MCP + DB + Docker)
- `Setting` database model with auto-migration and upsert persistence

#### Backend — Security Hardening
- **Project ownership checks**: `ListProjects` filters by `owner_id` for non-admin users; `GetProject`, `UpdateProject`, `DeleteProject` verify ownership via `isProjectOwnerOrAdmin()` helper
- **Flow-level authorization**: `checkFlowAccess()` JOINs flows with projects to verify parent project ownership; applied to `GetFlow`, `DeleteFlow`, `StartFlow`, `CancelFlow`, `ListApprovals`, `ApprovePhase`, `RejectPhase`
- **Admin middleware**: `RequireAdmin()` middleware protects user management endpoints (checks `user_role` from JWT context)
- **DB health timeout**: `GetHealthAll` wraps DB ping in `context.WithTimeout(ctx, 5s)`

### Changed
- Replaced old `GET/PUT /api/settings` with granular settings endpoints
- Removed 11 unused npm dependencies: `socket.io-client`, `@tanstack/react-query`, `lucide-react`, `recharts`, `zustand`, `date-fns`, `class-variance-authority`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`
- `useAgentWebSocket`: Fixed memory leak by storing `onMessage` callback in ref instead of dependency array
- Fixed `GetFlow()` nil check: `map[string]interface{}` uses `len() == 0` not `== nil`
- Fixed multiple handlers with missing error handling (`ListProjects`, `UpdateProject`, `DeleteFlow`, `CancelFlow`, `ApprovePhase`, `RejectPhase`)

### Fixed
- PostCSS configuration missing — Tailwind CSS now processes correctly
- Login page `useSearchParams` Suspense boundary (Next.js 15 requirement)
- TypeScript compilation: Extended `WSMessage` type with optional flattened fields, fixed component prop mismatches
- D3 drag type mismatch in `GraphVisualization`
- Router param mismatch: handlers now use `c.Param("user_id")` matching `:user_id` route

---

## [0.1.0] - 2025-02-24

### Added

#### Infrastructure
- `docker-compose.yml` — orchestrates 10 services: backend, frontend, kali-sandbox, 4 MCP servers (naabu, nuclei, metasploit, sqlmap), PostgreSQL 16 with pgvector, Neo4j 5, Redis 7
- `docker-compose.dev.yml` — hot-reload development overrides
- `docker-compose.observability.yml` — Grafana + Langfuse optional stack
- `.env.example` — complete environment configuration template with 40+ variables grouped by category
- `Makefile` — 20+ developer workflow targets (`dev`, `up`, `down`, `build`, `test`, `lint`, `migrate`, `db-shell`, `neo4j-shell`, `obs-up`)
- `.gitignore` — comprehensive exclusions for Go, Node, secrets, pentest artifacts, OS, and IDE files
- `LICENSE` — MIT with authorised-use-only security notice
- `CHANGELOG.md` — this file

#### Go Backend (`backend/`)
- **`pkg/config`** — Viper-based typed configuration loader with defaults and env-variable binding
- **`pkg/database`** — GORM models (9 entities: User, Project, Flow, Task, Action, Artifact, Session, MemoryRecord, ApprovalRequest); PostgreSQL client with pgvector; Neo4j 5 driver with constraint management
- **`pkg/llm`** — unified `Provider` interface with streaming support; implementations for Anthropic Claude (native SDK), OpenAI/OpenRouter/DeepSeek (shared OpenAI-compatible SDK), Ollama (REST); multi-provider `Manager` with parallel health checking and automatic fallback chain
- **`pkg/agent`** — Go-native ReAct (Reasoning + Acting) loop; `Reflector` for LLM tool-call drift detection and correction; `Summarizer` with configurable byte-limit context windowing (default 50KB/64KB); agent type enum and prompt template loader
- **`pkg/memory`** — `EvoGraph` with 5 Neo4j node types (AttackChain, ChainStep, ChainFinding, ChainDecision, ChainFailure), dual in-memory + Neo4j recording, cross-session intelligence via `FormatContext()`; pgvector 4-class semantic store (guide, task, research, result); unified `Manager`
- **`pkg/tools`** — tool `Registry` with agent-scoped lookup; unified `Executor` routing to MCP or Docker exec; built-in tools: `finish`, `shell`, `port_scan`, `vuln_scan`, `msf_exploit`, `sqli_test`
- **`pkg/mcp`** — MCP HTTP/SSE `Client` and multi-server `Manager` with parallel tool discovery and health checking
- **`pkg/docker`** — Docker SDK client wrapper; `Executor` for Kali sandbox `docker exec` with timeout and exit-code handling
- **`pkg/ws`** — gorilla/websocket `Hub` with flow-scoped broadcast; client read/write pumps; guidance injection support
- **`pkg/api`** — Gin router with all REST endpoints; JWT `Auth` middleware; zap request `Logger` middleware; handlers for flows, projects, models, auth, health checks
- **`pkg/templates/prompts`** — 5 agent prompt templates: `pentester`, `primary_agent`, `recon`, `coder`, `reporter`
- **`cmd/server`** — production server entrypoint wiring all dependencies; graceful shutdown; admin user seeding
- **`cmd/worker`** — standalone air-gapped worker node entrypoint
- **`Dockerfile`** — multi-stage build (builder → production alpine); dev stage with air hot-reload

#### MCP Servers (`mcp-servers/`)
- **`naabu`** — port scanning MCP server (tools: `port_scan`, `cdn_detect`)
- **`nuclei`** — vulnerability scanning MCP server (tools: `nuclei_scan`, `nuclei_list_templates`; output truncated to 8KB)
- **`metasploit`** — exploitation MCP server (tools: `msf_exploit`, `msf_search`, `msf_sessions_list`, `msf_session_cmd`)
- **`sqlmap`** — SQL injection MCP server (tools: `sqli_test`, `sqli_dump`)
- Each server: `main.go`, `go.mod`, `Dockerfile`

#### Kali Linux Image (`docker/kali/`)
- Custom `Dockerfile` based on `kalilinux/kali-rolling`
- Tool groups: network recon (nmap, masscan), OSINT (amass, subfinder), web testing (gobuster, nikto, sqlmap, wfuzz, wpscan), exploitation (metasploit-framework), AD/Windows (evil-winrm, bloodhound, crackmapexec, certipy-ad, responder), password attacks (hydra, john, hashcat, medusa)
- Go-based tools: httpx, nuclei, naabu, katana, subfinder, dnsx (installed from source)
- Nuclei template auto-update on image build

#### Frontend (`frontend/`)
- **Next.js 16 + TypeScript** app with App Router
- Tailwind CSS with terminal-aesthetic dark theme (`pentagron-bg`, `pentagron-primary`, severity colour tokens)
- `src/types/index.ts` — complete shared type definitions (Flow, Task, Action, Artifact, WSMessage, GraphNode, ModelInfo)
- `src/lib/api.ts` — axios API client with JWT injection, 401 redirect, and typed helpers for all endpoints
- `src/hooks/useAgentWebSocket.ts` — WebSocket hook with auto-reconnect and guidance injection
- `src/app/page.tsx` — project dashboard with stats grid
- `src/app/layout.tsx` + `globals.css` — layout, severity badge styles, chain-active pulse animation
- **`Dockerfile`** — multi-stage build (deps → builder → production standalone)

#### Project Documentation
- `README.md` — enterprise-grade documentation with architecture diagram, feature matrix, API reference, EvoGraph schema, and security notice
- `CLAUDE.md` — Claude Code project instructions and architecture reference
- `.claude/memory/MEMORY.md` — version-controlled project memory
- `.claude/plans/pentagron-architecture.md` — archived approved architecture plan

---

[Unreleased]: https://github.com/heytherevibin/Pentagron/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/heytherevibin/Pentagron/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/heytherevibin/Pentagron/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/heytherevibin/Pentagron/releases/tag/v0.1.0
