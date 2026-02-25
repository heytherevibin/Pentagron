# Pentagron Project Memory

## Project Overview
- **Name**: Pentagron — Fully Automated AI Penetration Testing Framework
- **Root**: `/Users/heytherevibin/Downloads/code/Pentagron`
- **GitHub**: https://github.com/heytherevibin/Pentagron
- **Status**: Phase 3 complete — backend, frontend (Mission Control UI), and security hardening all done
- **Architecture**: Hybrid autonomous pentesting platform — ReAct agent + EvoGraph + MCP tools

## Tech Stack
- **Backend**: Go 1.23, Gin, GORM, module `github.com/pentagron/pentagron`
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
- **EvoGraph**: dual-recording (in-memory + Neo4j), 5 node types
- **Tool execution**: MCP → Docker exec fallback for all Kali tools
- **Phase-gated approvals**: mandatory before exploitation phase
- **Anthropic SDK**: v0.2.0-alpha.13 — uses `anthropic.F(value)` param.Field[T] pattern
- **OpenAI SDK**: v0.1.0-alpha.62 — uses `openai.F(value)` param.Field[T] pattern
- **Mission Control UI**: JetBrains Mono, mc-* colour palette, dot-grid background, 2px sharp corners
- **Auth**: Dual token storage (localStorage + cookie), Next.js middleware for route protection
- **Settings**: Granular endpoints (general, llm, mcp) with live persistence to `settings` table
- **Authorization**: Project ownership checks + flow-level access via parent project JOIN

## Frontend Route Structure
```
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

## Critical File Paths
- `backend/pkg/api/router.go` — all Gin routes
- `backend/pkg/api/handlers/auth.go` — login, projects CRUD, ownership checks
- `backend/pkg/api/handlers/flows.go` — flow CRUD, approvals, access control
- `backend/pkg/api/handlers/settings.go` — settings CRUD, health, LLM/MCP testing
- `backend/pkg/api/handlers/users.go` — user management (admin only)
- `backend/pkg/api/handlers/activity.go` — activity feed
- `backend/pkg/api/middleware/auth.go` — JWT auth + RequireAdmin middleware
- `backend/pkg/database/models.go` — GORM models including Setting
- `frontend/src/lib/api.ts` — typed Axios client with all endpoint helpers
- `frontend/middleware.ts` — cookie-based route protection

## Known Issues / Gotchas
- Go embed cannot use `..` path traversal — prompts live in `backend/pkg/agent/prompts/`
- React 19 types: `useRef<T>()` requires explicit arg; use `useRef<T | undefined>(undefined)`
- EvoGraph API endpoint for graph data not yet implemented (flows/[id] shows empty graph stub)
- D3 drag types need `as any` cast due to type incompatibility with force simulation
- `useAgentWebSocket`: onMessage must be stored in ref to prevent reconnect loops
- `user_projects` table not yet created — ListUsers gracefully handles missing table

## Next Steps
1. `make env-setup && make up` — boot all containers and smoke test
2. End-to-end test: login → project → flow → start → approve → complete
3. Implement EvoGraph read API endpoint for graph visualization
4. PDF report export (backend-generated)
5. Grafana dashboard templates
6. Langfuse tracing integration
