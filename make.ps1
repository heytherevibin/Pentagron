# make.ps1 — Windows PowerShell wrapper for Makefile targets
# Usage: .\make.ps1 <target>   e.g.  .\make.ps1 up
#
# Mac/Linux: use `make <target>` directly.

param([string]$Target = "help")

$COMPOSE     = "docker-compose -f docker-compose.yml"
$COMPOSE_DEV = "$COMPOSE -f docker-compose.dev.yml"
$COMPOSE_OBS = "$COMPOSE -f docker-compose.observability.yml"
$BACKEND     = ".\backend"
$FRONTEND    = ".\frontend"

function Invoke-Cmd($cmd) {
    Write-Host "> $cmd" -ForegroundColor Cyan
    Invoke-Expression $cmd
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

switch ($Target) {
    # ── Development ────────────────────────────────────────────────────────────
    "dev"            { Invoke-Cmd "$COMPOSE_DEV up" }
    "dev-backend"    { Invoke-Cmd "$COMPOSE_DEV up pentagron-backend postgres neo4j redis" }

    # ── Production ─────────────────────────────────────────────────────────────
    "up"             { Invoke-Cmd "$COMPOSE up -d" }
    "down"           { Invoke-Cmd "$COMPOSE down" }
    "restart"        { Invoke-Cmd "$COMPOSE down"; Invoke-Cmd "$COMPOSE up -d" }

    # ── Build ──────────────────────────────────────────────────────────────────
    "build"          { Invoke-Cmd "$COMPOSE build" }
    "rebuild"        { Invoke-Cmd "$COMPOSE build --no-cache" }
    "build-backend"  { Invoke-Cmd "$COMPOSE build pentagron-backend" }
    "build-frontend" { Invoke-Cmd "$COMPOSE build pentagron-frontend" }

    # ── Observability ──────────────────────────────────────────────────────────
    "obs-up"         { Invoke-Cmd "$COMPOSE_OBS up -d" }
    "obs-down"       { Invoke-Cmd "$COMPOSE_OBS down" }

    # ── Logs ───────────────────────────────────────────────────────────────────
    "logs"           { Invoke-Cmd "$COMPOSE logs -f" }
    "logs-backend"   { Invoke-Cmd "$COMPOSE logs -f pentagron-backend" }
    "logs-frontend"  { Invoke-Cmd "$COMPOSE logs -f pentagron-frontend" }

    # ── Database ───────────────────────────────────────────────────────────────
    "migrate"        { Invoke-Cmd "cd $BACKEND && go run ./cmd/migrate/..." }
    "migrate-down"   { Invoke-Cmd "cd $BACKEND && go run ./cmd/migrate/... down" }
    "db-shell"       { Invoke-Cmd "$COMPOSE exec postgres psql -U pentagron -d pentagron" }
    "neo4j-shell"    { Invoke-Cmd "$COMPOSE exec neo4j cypher-shell -u neo4j -p pentagron" }

    # ── Testing ────────────────────────────────────────────────────────────────
    "test"           { Push-Location $BACKEND; Invoke-Cmd "go test ./... -v -race"; Pop-Location }
    "test-cover"     { Push-Location $BACKEND; Invoke-Cmd "go test ./... -coverprofile=coverage.out"; Invoke-Cmd "go tool cover -html=coverage.out"; Pop-Location }
    "test-e2e"       { Push-Location $BACKEND; Invoke-Cmd "go test -tags=integration ./integration/... -v -timeout=120s"; Pop-Location }

    # ── Linting ────────────────────────────────────────────────────────────────
    "lint"           { Push-Location $BACKEND; Invoke-Cmd "golangci-lint run ./..."; Pop-Location }
    "lint-fix"       { Push-Location $BACKEND; Invoke-Cmd "golangci-lint run --fix ./..."; Pop-Location }
    "fmt"            { Push-Location $BACKEND; Invoke-Cmd "gofmt -w ."; Pop-Location }

    # ── Go tools ───────────────────────────────────────────────────────────────
    "tidy"           { Push-Location $BACKEND; Invoke-Cmd "go mod tidy"; Pop-Location }
    "vet"            { Push-Location $BACKEND; Invoke-Cmd "go vet ./..."; Pop-Location }

    # ── Frontend ───────────────────────────────────────────────────────────────
    "fe-install"     { Push-Location $FRONTEND; Invoke-Cmd "npm install"; Pop-Location }
    "fe-build"       { Push-Location $FRONTEND; Invoke-Cmd "npm run build"; Pop-Location }
    "fe-lint"        { Push-Location $FRONTEND; Invoke-Cmd "npm run lint"; Pop-Location }

    # ── Clean ──────────────────────────────────────────────────────────────────
    "clean"          { Invoke-Cmd "$COMPOSE down -v --remove-orphans" }
    "clean-images"   { Invoke-Cmd "$COMPOSE down --rmi local" }

    # ── Env ────────────────────────────────────────────────────────────────────
    "env-setup" {
        if (Test-Path ".env") {
            Write-Host ".env already exists" -ForegroundColor Yellow
        } else {
            Copy-Item ".env.example" ".env"
            Write-Host ".env created — fill in your API keys" -ForegroundColor Green
        }
    }

    # ── Help ───────────────────────────────────────────────────────────────────
    "help" {
        Write-Host ""
        Write-Host "Pentagron — available targets:" -ForegroundColor Green
        Write-Host ""
        $targets = @(
            @{ name="env-setup";     desc="Copy .env.example to .env (first-time setup)" },
            @{ name="up";            desc="Start all services in production mode" },
            @{ name="down";          desc="Stop all services" },
            @{ name="restart";       desc="Restart all services" },
            @{ name="dev";           desc="Start all services in dev mode (hot reload)" },
            @{ name="dev-backend";   desc="Start only backend + databases in dev mode" },
            @{ name="build";         desc="Build all Docker images" },
            @{ name="rebuild";       desc="Force rebuild all Docker images (no cache)" },
            @{ name="logs";          desc="Tail all service logs" },
            @{ name="logs-backend";  desc="Tail backend logs" },
            @{ name="test";          desc="Run Go unit tests (-race)" },
            @{ name="test-cover";    desc="Run Go tests with coverage report" },
            @{ name="test-e2e";      desc="Run E2E integration tests (requires: up)" },
            @{ name="lint";          desc="Run golangci-lint" },
            @{ name="fmt";           desc="Format Go code" },
            @{ name="tidy";          desc="go mod tidy" },
            @{ name="migrate";       desc="Run database migrations" },
            @{ name="db-shell";      desc="Open psql shell" },
            @{ name="obs-up";        desc="Start Grafana + Langfuse observability stack" },
            @{ name="clean";         desc="Remove containers and volumes (WARNING: deletes data)" }
        )
        foreach ($t in $targets) {
            Write-Host ("  {0,-20} {1}" -f $t.name, $t.desc) -ForegroundColor Cyan
        }
        Write-Host ""
    }

    default {
        Write-Host "Unknown target: $Target" -ForegroundColor Red
        Write-Host "Run .\make.ps1 help to see available targets." -ForegroundColor Yellow
        exit 1
    }
}
