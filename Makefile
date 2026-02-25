.PHONY: up down dev build rebuild logs test test-e2e lint migrate clean help

COMPOSE        := docker-compose -f docker-compose.yml
COMPOSE_DEV    := $(COMPOSE) -f docker-compose.dev.yml
COMPOSE_OBS    := $(COMPOSE) -f docker-compose.observability.yml
BACKEND_DIR    := ./backend
FRONTEND_DIR   := ./frontend

## ── Development ───────────────────────────────────────────────────────────────
dev: ## Start all services in dev mode (hot reload)
	$(COMPOSE_DEV) up

dev-backend: ## Start only backend in dev mode
	$(COMPOSE_DEV) up pentagron-backend postgres neo4j redis

## ── Production ────────────────────────────────────────────────────────────────
up: ## Start all services in production mode
	$(COMPOSE) up -d

down: ## Stop all services
	$(COMPOSE) down

restart: down up ## Restart all services

## ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build all Docker images
	$(COMPOSE) build

rebuild: ## Force rebuild all Docker images (no cache)
	$(COMPOSE) build --no-cache

build-backend: ## Build only the backend image
	$(COMPOSE) build pentagron-backend

build-frontend: ## Build only the frontend image
	$(COMPOSE) build pentagron-frontend

## ── Observability ─────────────────────────────────────────────────────────────
obs-up: ## Start observability stack (Grafana + Langfuse)
	$(COMPOSE_OBS) up -d

obs-down: ## Stop observability stack
	$(COMPOSE_OBS) down

## ── Logs ──────────────────────────────────────────────────────────────────────
logs: ## Tail all service logs
	$(COMPOSE) logs -f

logs-backend: ## Tail backend logs
	$(COMPOSE) logs -f pentagron-backend

logs-frontend: ## Tail frontend logs
	$(COMPOSE) logs -f pentagron-frontend

## ── Database ──────────────────────────────────────────────────────────────────
migrate: ## Run database migrations
	cd $(BACKEND_DIR) && go run ./cmd/migrate/...

migrate-down: ## Roll back last migration
	cd $(BACKEND_DIR) && go run ./cmd/migrate/... down

db-shell: ## Open psql shell
	$(COMPOSE) exec postgres psql -U pentagron -d pentagron

neo4j-shell: ## Open Neo4j cypher-shell
	$(COMPOSE) exec neo4j cypher-shell -u neo4j -p pentagron

## ── Testing ───────────────────────────────────────────────────────────────────
test: ## Run Go tests
	cd $(BACKEND_DIR) && go test ./... -v -race

test-cover: ## Run Go tests with coverage report
	cd $(BACKEND_DIR) && go test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out

test-e2e: ## Run end-to-end integration tests (requires: make up)
	cd $(BACKEND_DIR) && go test -tags=integration ./integration/... -v -timeout=120s

## ── Linting ───────────────────────────────────────────────────────────────────
lint: ## Run golangci-lint on backend
	cd $(BACKEND_DIR) && golangci-lint run ./...

lint-fix: ## Run golangci-lint with auto-fix
	cd $(BACKEND_DIR) && golangci-lint run --fix ./...

fmt: ## Format Go code
	cd $(BACKEND_DIR) && gofmt -w .

## ── Go tools ──────────────────────────────────────────────────────────────────
tidy: ## Tidy Go module dependencies
	cd $(BACKEND_DIR) && go mod tidy

vet: ## Run go vet
	cd $(BACKEND_DIR) && go vet ./...

## ── Frontend ──────────────────────────────────────────────────────────────────
fe-install: ## Install frontend dependencies
	cd $(FRONTEND_DIR) && npm install

fe-build: ## Build frontend for production
	cd $(FRONTEND_DIR) && npm run build

fe-lint: ## Lint frontend code
	cd $(FRONTEND_DIR) && npm run lint

## ── Clean ─────────────────────────────────────────────────────────────────────
clean: ## Remove containers and volumes (WARNING: deletes data)
	$(COMPOSE) down -v --remove-orphans

clean-images: ## Remove built images
	$(COMPOSE) down --rmi local

## ── Env ───────────────────────────────────────────────────────────────────────
env-setup: ## Copy .env.example to .env (only if .env doesn't exist)
	@[ -f .env ] && echo ".env already exists" || (cp .env.example .env && echo ".env created — fill in your API keys")

## ── Help ──────────────────────────────────────────────────────────────────────
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
