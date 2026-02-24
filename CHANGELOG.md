# Changelog

All notable changes to Pentagron are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Flow orchestration engine (`pkg/flow/flow.go`, `task.go`, `provider.go`)
- Six-phase recon pipeline (`pkg/recon/orchestrator.go`)
- Frontend pages: `/login`, `/projects/[id]`, `/flows/[id]`, `/settings`
- Frontend components: `AgentChat`, `GraphVisualization`, `ApprovalDialogs`, `AgentTimeline`
- `go mod tidy` and dependency lock
- End-to-end integration tests
- Grafana dashboard templates
- Langfuse tracing integration
- Air-gapped worker node mutual TLS

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

[Unreleased]: https://github.com/heytherevibin/Pentagron/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/heytherevibin/Pentagron/releases/tag/v0.1.0
