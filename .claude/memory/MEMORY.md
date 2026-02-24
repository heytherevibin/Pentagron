# Pentagron Project Memory

## Project Overview
- **Name**: Pentagron — Fully Automated AI Penetration Testing Framework
- **Root**: `c:\Users\MATHEV03\Downloads\Code\pegatron`
- **GitHub**: https://github.com/heytherevibin/Pentagron
- **Status**: Full scaffold complete (Phase 1 done), git initialized
- **Architecture**: Hybrid autonomous pentesting platform — ReAct agent + EvoGraph + MCP tools

## Tech Stack
- **Backend**: Go 1.23, Gin, GORM, module `github.com/pentagron/pentagron`
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
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

## Agent Tiers
| Tier | Model | Agents |
|------|-------|--------|
| 1 (Heavy) | claude-opus-4-6 | Orchestrator, Pentester |
| 2 (Balanced) | claude-sonnet-4-6 | Recon, Coder |
| 3 (Fast) | claude-haiku-4-5 | Reporter, Summarizer |

## Critical File Paths
- `backend/pkg/llm/provider.go` — LLMProvider interface
- `backend/pkg/llm/manager.go` — multi-provider manager with fallback
- `backend/pkg/agent/react.go` — ReAct loop
- `backend/pkg/agent/reflector.go` — free-text drift detection
- `backend/pkg/agent/summarizer.go` — context windowing (50KB/64KB limits)
- `backend/pkg/memory/evograph.go` — EvoGraph (5 node types)
- `backend/pkg/memory/vector.go` — pgvector 4-class store
- `backend/pkg/tools/registry.go` — tool registration
- `backend/pkg/tools/executor.go` — built-in tools wired up
- `backend/pkg/mcp/client.go` — MCP HTTP/SSE client
- `backend/pkg/api/router.go` — all Gin routes
- `backend/cmd/server/main.go` — wires all dependencies

## Service Ports
| Service | Port |
|---------|------|
| Backend | 8080 |
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

## Scaffold Completeness
All Phase 1 scaffolding tasks completed:
1. ✅ Directory structure
2. ✅ docker-compose.yml + dev + observability variants
3. ✅ .env.example
4. ✅ Makefile
5. ✅ Go backend: config, database, llm, agent, memory, tools, mcp, docker, ws, api
6. ✅ cmd/server/main.go + cmd/worker/main.go
7. ✅ MCP servers: naabu, nuclei, metasploit, sqlmap
8. ✅ docker/kali/Dockerfile + docker/postgres/init.sql
9. ✅ Frontend: Next.js 16 scaffold
10. ✅ backend/Dockerfile + frontend/Dockerfile
11. ✅ README.md (enterprise grade)
12. ✅ LICENSE (MIT + security notice)
13. ✅ CHANGELOG.md
14. ✅ .gitignore
15. ✅ CLAUDE.md

## Next Steps
- `go mod tidy` to resolve dependencies
- Implement `flow/flow.go`, `flow/task.go`, `flow/provider.go`
- Wire `recon/orchestrator.go` six-phase pipeline
- Add frontend components: AgentChat, GraphVisualization, ApprovalDialogs
- Add frontend pages: /login, /projects/[id], /flows/[id], /settings
- Run `make up` to verify all containers boot
