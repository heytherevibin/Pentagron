# Pentagron Architecture Plan

**Created**: 2025-02-24
**Status**: Phase 1 complete — scaffold built and pushed to GitHub

---

## System Design

Pentagron is a 7-layer autonomous AI pentesting platform:

```
┌─────────────────────────────────────────────────────────┐
│                    PENTAGRON PLATFORM                   │
├─────────────────────────────────────────────────────────┤
│  Layer 7: Frontend (Next.js 16 + React 19 + Tailwind)  │
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

Cross-session intelligence: `FormatContext()` queries prior chains for critical/high findings
and injects them as context into new engagements against the same target scope.

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

## MCP Tool Servers

| Server | Port | Tools |
|--------|------|-------|
| naabu | 8000 | `port_scan`, `cdn_detect` |
| sqlmap | 8001 | `sqli_test`, `sqli_dump` |
| nuclei | 8002 | `nuclei_scan`, `nuclei_list_templates` |
| metasploit | 8003 | `msf_search`, `msf_exploit`, `msf_sessions_list`, `msf_session_cmd` |

All MCP servers are standalone Go binaries using `mark3labs/mcp-go v0.18.0`.

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

### Neo4j (EvoGraph)
- Nodes: `AttackChain`, `ChainStep`, `ChainFinding`, `ChainDecision`, `ChainFailure`
- Indexes: uniqueness on `id` for all node types
- Recon nodes: `ReconTarget`, `ReconPort`, `ReconVuln`, `ReconPath`

---

## Frontend Architecture

```
app/
  page.tsx              ← Dashboard
  login/page.tsx        ← Auth (TODO)
  projects/[id]/        ← Project detail (TODO)
  flows/[id]/           ← Flow live view (TODO)
  settings/             ← Config (TODO)

components/
  AgentChat.tsx         ← Live ReAct stream (TODO)
  GraphVisualization.tsx ← D3 EvoGraph render (TODO)
  ApprovalDialogs.tsx   ← Phase gate UI (TODO)
```

---

## Phase 2 Implementation Order

1. **`go mod tidy`** — resolve all Go dependencies
2. **`flow/` package** — `flow.go`, `task.go`, `provider.go` skeleton
3. **`recon/orchestrator.go`** — six-phase pipeline wiring
4. **Frontend components** — AgentChat, GraphVisualization, ApprovalDialogs
5. **Frontend pages** — /login, /projects/[id], /flows/[id], /settings
6. **Integration tests** — end-to-end flow against a test target
7. **`make up`** — verify all 10 containers boot cleanly
