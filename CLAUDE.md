# Pentagron — Claude Code Project Instructions

## Project Overview
**Pentagron** is a fully automated AI penetration testing framework built in Go. It combines
an autonomous ReAct agent loop, multi-provider LLM gateway, EvoGraph attack-chain memory,
and a suite of MCP-wrapped offensive security tools into a single deployable monorepo.

## Stack
- **Backend**: Go 1.24, Gin, GORM, module `github.com/pentagron/pentagron`
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Graph DB**: Neo4j 5 (EvoGraph + recon graph)
- **Vector DB**: PostgreSQL 16 + pgvector
- **Cache/Queue**: Redis 7
- **MCP Servers**: Go, `mark3labs/mcp-go`
- **LLM Providers**: Anthropic (primary), OpenAI, OpenRouter, DeepSeek, Ollama

## Architecture Rules
- **Go-only backend** — no Python, no shell scripts in the hot path
- **ReAct loop** is implemented natively in Go (`backend/pkg/agent/react.go`) — do NOT introduce LangGraph or LangChainGo
- **LLM abstraction** lives in `backend/pkg/llm/provider.go` — always implement the `Provider` interface; never call provider SDKs directly from agent code
- **Tool execution** goes through `backend/pkg/tools/registry.go` → MCP client → Docker exec fallback
- **Phase-gated approvals** are mandatory before any exploitation phase transition — never skip `ApprovalRequest` creation

## Key File Paths
| Path | Purpose |
|------|---------|
| `backend/pkg/llm/provider.go` | LLMProvider interface + shared types |
| `backend/pkg/llm/manager.go` | Multi-provider manager with fallback |
| `backend/pkg/agent/react.go` | ReAct loop (Reason → Act → Observe) |
| `backend/pkg/agent/reflector.go` | Free-text drift detection + correction |
| `backend/pkg/agent/summarizer.go` | Context windowing (50KB/64KB limits) |
| `backend/pkg/memory/evograph.go` | EvoGraph — 5 node types, Neo4j-backed |
| `backend/pkg/memory/vector.go` | pgvector semantic memory (4 classes) |
| `backend/pkg/tools/registry.go` | Tool registration |
| `backend/pkg/tools/executor.go` | Built-in tools wired up |
| `backend/pkg/mcp/client.go` | MCP HTTP/SSE client |
| `backend/pkg/api/router.go` | All Gin routes |
| `backend/pkg/api/handlers/workers.go` | Worker register/poll/result handlers |
| `backend/pkg/agent/prompts/post_exploitation.tmpl` | Post-exploit agent prompt |
| `backend/pkg/mtls/mtls.go` | Mutual TLS helpers (server + client configs, TLS 1.3) |
| `backend/integration/e2e_test.go` | End-to-end integration tests (build tag: integration) |
| `backend/cmd/server/main.go` | Dependency wiring + server start |

## Service Ports
| Service | Port |
|---------|------|
| Backend API | 8080 |
| Frontend | 3000 |
| MCP Naabu | 8000 |
| MCP SQLMap | 8001 |
| MCP Nuclei | 8002 |
| MCP Metasploit | 8003 |
| Neo4j Browser | 7474 |
| Neo4j Bolt | 7687 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Grafana | 3001 |
| Langfuse | 4000 |

## Development Workflow
```bash
make env-setup   # copy .env.example → .env
make up          # start all containers
make dev         # hot-reload backend + frontend
make test        # run Go unit tests (no integration tag)
make test-e2e    # run end-to-end tests (requires: make up)
make lint        # golangci-lint
make tidy        # go mod tidy
```

## Coding Conventions
- All Go packages use lowercase names, no underscores
- Error wrapping: `fmt.Errorf("context: %w", err)` — always wrap, never discard
- Context propagation: every function that calls IO must accept `context.Context` as first arg
- No `init()` functions — use explicit `New*()` constructors
- Struct fields exported only when needed by JSON/GORM/external packages
- Use `slog` (stdlib) for structured logging — do NOT add a logging framework
- Frontend: functional components only, `use client` directive only where strictly needed

## Security Rules
- Never log secrets, tokens, or credentials — use `[REDACTED]` placeholders
- Shell commands executed inside the `kali-sandbox` container only — never on the host
- All user-supplied target strings must be validated/sanitised before passing to tools
- JWT secrets and API keys must come from environment variables — never hardcode

## Memory & Plans
Project-local Claude memory lives in `.claude/memory/MEMORY.md`.
Architecture plans live in `.claude/plans/`.
Update these files when you make significant architectural changes.

## Current Status
Phases 1-4 complete (100%). All pipeline phases implemented including post-exploitation and air-gapped worker mTLS. CI/CD, unit tests, integration tests, worker HTTP comms, observability (Grafana + Langfuse), and mutual TLS are all shipped. Both `go build ./...` and `npm run build` pass clean.

## Next Implementation Steps
1. `make env-setup && make up` — boot all containers and smoke test
2. `make test-e2e` — run end-to-end integration tests against live stack
