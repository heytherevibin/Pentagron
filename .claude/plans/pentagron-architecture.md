# Pentagron Architecture Plan

**Created**: 2025-02-24
**Updated**: 2026-02-25
**Status**: Phase 3 complete — backend + frontend (Mission Control UI) + security hardening all built

---

## System Design

Pentagron is a 7-layer autonomous AI pentesting platform:

```
┌─────────────────────────────────────────────────────────┐
│                    PENTAGRON PLATFORM                   │
├─────────────────────────────────────────────────────────┤
│  Layer 7: Frontend (Next.js 15 + React 19 + Tailwind)  │
├─────────────────────────────────────────────────────────┤
│  Layer 6: REST API + WebSocket (Gin)                   │
├─────────────────────────────────────────────────────────┤
│  Layer 5: Orchestration Engine (ReAct Agent Loop)      │
├─────────────────────────────────────────────────────────┤
│  Layer 4: LLM Gateway (5 providers + fallback chain)   │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Tool Execution (MCP + Docker exec)           │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Intelligence Graph (EvoGraph + pgvector)     │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Infrastructure (PostgreSQL + Neo4j + Redis)  │
└─────────────────────────────────────────────────────────┘
```

---

## Five-Phase Pentest Pipeline

| Phase | Description | Gate |
|-------|-------------|------|
| 1. Reconnaissance | Passive + active discovery (naabu, dnsx, httpx, nuclei) | Auto |
| 2. Analysis | Vulnerability analysis, attack path ranking | Auto |
| 3. Exploitation | CVE exploitation, brute-force, SQLi | **Human approval required** |
| 4. Post-Exploitation | Lateral movement, credential harvest, persistence | Auto |
| 5. Reporting | PDF/Markdown report generation, CVSS scoring | Auto |

---

## ReAct Agent Loop

```
Task Input
    │
    ▼
Build Prompt (system + history + tools + EvoGraph context)
    │
    ▼
LLM Call (provider with fallback)
    │
    ├─► Text response? ──► Reflector check ──► inject correction → loop
    │
    └─► Tool calls? ──► execute tools ──► observe results ──► loop
                              │
                              ▼
                        Record in EvoGraph
                              │
                              ▼
                        Check summarizer (50KB threshold)
                              │
                              ▼
                        Max iterations? ──► Return result
```

---

## EvoGraph Node Types

| Node Type | Purpose |
|-----------|---------|
| `AttackChain` | Root node — one per engagement session |
| `ChainStep` | Individual tool execution step |
| `ChainFinding` | Vulnerability or discovery (with CVSS severity) |
| `ChainDecision` | Strategic decision point (branch in attack path) |
| `ChainFailure` | Failed attempt + lesson learned |

Relationships: `HAS_STEP`, `LEADS_TO`, `PRODUCED`, `INFORMED_BY`, `FAILED_WITH`

---

## LLM Provider Architecture

```
Manager
  ├── AnthropicProvider  (claude-opus-4-6 / sonnet / haiku)
  ├── OpenAIProvider     (gpt-4o / gpt-4o-mini)
  ├── OpenRouterProvider (any model via openrouter.ai)
  ├── DeepSeekProvider   (deepseek-chat / deepseek-reasoner)
  └── OllamaProvider     (local models via REST)

Fallback chain: primary → fallback[0] → fallback[1] → error
```

Agent tier defaults:
- Tier 1 (Orchestrator, Pentester): `claude-opus-4-6`
- Tier 2 (Recon, Coder): `claude-sonnet-4-6`
- Tier 3 (Reporter, Summarizer): `claude-haiku-4-5`

---

## Frontend Architecture (Mission Control UI)

```
app/
  login/page.tsx              ← Public auth (dual token: localStorage + cookie)
  setup/page.tsx              ← First-run setup wizard (3 steps)
  (authenticated)/
    layout.tsx                ← TopNav + CommandPalette + notification prompt
    page.tsx                  ← Dashboard (4 stats, project table, activity feed)
    projects/new/page.tsx     ← Create project (TagInput for scope)
    projects/[id]/page.tsx    ← Project detail + flows table
    flows/[id]/page.tsx       ← Mission control (3-panel: chat|telemetry|graph)
    settings/page.tsx         ← Admin panel (6 tabs: General|LLM|Agents|MCP|Users|Health)

components/ui/               ← 17 primitives (GlowDot, Panel, Button, Input, etc.)
components/                   ← AgentChat, GraphVisualization, ApprovalDialog
middleware.ts                 ← Cookie-based route protection
```

Design system: JetBrains Mono, mc-* palette, dot-grid background, 2px corners, emerald/crimson accents.

---

## API Architecture

### Auth & Core
- `POST /api/auth/login` + `/logout`
- `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id` (ownership-scoped)
- `GET/POST /api/projects/:id/flows` (project-scoped)
- `GET/DELETE /api/flows/:id`, `POST /api/flows/:id/start|cancel` (access-controlled)
- `GET /api/flows/:id/approvals`, `POST /api/flows/:id/approve|reject`

### Settings (granular)
- `GET/PUT /api/settings/general` — runtime config
- `GET/PUT /api/settings/llm` + `POST /api/settings/llm/test`
- `GET/PUT /api/settings/mcp` + `POST /api/settings/mcp/test`

### Admin
- `GET/POST /api/users`, `PUT/DELETE /api/users/:user_id` (admin only)
- `POST /api/users/:user_id/reset-password`

### System
- `GET /health`, `GET /api/models`, `GET /api/health/all`, `GET /api/activity`

### WebSocket
- `WS /ws/agent/:session_id?flow_id=<id>` — bidirectional agent chat
- `WS /ws/logs/:flow_id` — read-only log stream

---

## Security Model

- **JWT auth**: HMAC-SHA256, 24h expiry, `user_id` + `user_email` + `user_role` claims
- **Project ownership**: Non-admin users only see/modify their own projects
- **Flow access control**: JOINs flow → project to verify parent ownership
- **Admin gates**: User management endpoints require `role == "admin"`
- **Tool sandbox**: All commands execute in Kali Docker container, never on host

---

## MCP Tool Servers

| Server | Port | Tools |
|--------|------|-------|
| naabu | 8000 | `port_scan`, `cdn_detect` |
| sqlmap | 8001 | `sqli_test`, `sqli_dump` |
| nuclei | 8002 | `nuclei_scan`, `nuclei_list_templates` |
| metasploit | 8003 | `msf_search`, `msf_exploit`, `msf_sessions_list`, `msf_session_cmd` |

---

## Database Schema Summary

### PostgreSQL (GORM models)
- `users` — authentication, role (admin/operator/viewer)
- `projects` — scoped engagement containers
- `flows` — autonomous pentest runs (status: pending/running/paused/completed/failed)
- `tasks` — subtasks within a flow
- `actions` — individual tool calls with input/output
- `artifacts` — findings, files, screenshots
- `sessions` — LLM conversation history
- `memory_records` — pgvector embeddings (4 classes)
- `approval_requests` — phase gate checkpoints
- `settings` — key/value runtime config with upsert

### Neo4j (EvoGraph)
- Nodes: `AttackChain`, `ChainStep`, `ChainFinding`, `ChainDecision`, `ChainFailure`
- Indexes: uniqueness on `id` for all node types

---

## Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Infrastructure scaffold (Docker, Makefiles, configs) | Done |
| 2 | Backend implementation (agent, LLM, tools, API, flow engine) | Done |
| 3 | Frontend Mission Control UI + security hardening | Done |
| 4 | Integration testing + observability | Next |

## Remaining Work
1. Boot all containers and smoke test (`make up`)
2. End-to-end integration test (login → project → flow → approve → report)
3. EvoGraph read API endpoint for real-time graph visualization
4. PDF report export (backend-generated with Pentagron branding)
5. Grafana dashboard templates for agent metrics
6. Langfuse tracing integration
7. Air-gapped worker node mutual TLS
