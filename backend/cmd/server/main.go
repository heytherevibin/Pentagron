package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"golang.org/x/crypto/bcrypt"

	"github.com/pentagron/pentagron/pkg/api"
	"github.com/pentagron/pentagron/pkg/api/handlers"
	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/database"
	"github.com/pentagron/pentagron/pkg/docker"
	"github.com/pentagron/pentagron/pkg/flow"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"github.com/pentagron/pentagron/pkg/memory"
	"github.com/pentagron/pentagron/pkg/mtls"
	"github.com/pentagron/pentagron/pkg/telemetry"
	"github.com/pentagron/pentagron/pkg/tools"
	"github.com/pentagron/pentagron/pkg/ws"
	"gorm.io/gorm"
)

func main() {
	// ── Config ─────────────────────────────────────────────────────────────────
	cfg := config.MustLoad()

	// ── Logger ─────────────────────────────────────────────────────────────────
	log := buildLogger(cfg.LogLevel)
	defer log.Sync()

	log.Info("starting Pentagron backend",
		zap.String("port", cfg.ServerPort),
		zap.String("gin_mode", cfg.GinMode),
	)

	// ── Gin mode ───────────────────────────────────────────────────────────────
	gin.SetMode(cfg.GinMode)

	// ── PostgreSQL ─────────────────────────────────────────────────────────────
	log.Info("connecting to PostgreSQL")
	// Viper may not resolve DSN from env unless explicitly bound; fall back to env or parts.
	postgresDSN := cfg.PostgresDSN
	if postgresDSN == "" {
		postgresDSN = os.Getenv("POSTGRES_DSN")
	}
	if postgresDSN == "" {
		postgresDSN = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
			cfg.PostgresUser, cfg.PostgresPassword, cfg.PostgresHost, cfg.PostgresPort, cfg.PostgresDB)
	}
	db, err := database.NewPostgres(postgresDSN, cfg.LogLevel)
	if err != nil {
		log.Fatal("postgres connection failed", zap.Error(err))
	}

	// Seed admin user
	if err := seedAdmin(db, cfg); err != nil {
		log.Warn("admin seed failed", zap.Error(err))
	}

	// ── Neo4j ─────────────────────────────────────────────────────────────────
	var neo4jClient *database.Neo4jClient
	if cfg.EvoGraphEnabled {
		log.Info("connecting to Neo4j")
		neo4jClient, err = database.NewNeo4j(cfg.Neo4jURI, cfg.Neo4jUser, cfg.Neo4jPassword)
		if err != nil {
			log.Warn("neo4j connection failed — EvoGraph disabled", zap.Error(err))
		} else {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := neo4jClient.EnsureConstraints(ctx); err != nil {
				log.Warn("neo4j constraints failed", zap.Error(err))
			}
		}
	}

	// ── Memory (EvoGraph + VectorStore) ───────────────────────────────────────
	var neo4jDriver interface{ Close(context.Context) error }
	_ = neo4jDriver
	var memMgr *memory.Manager
	if neo4jClient != nil {
		memMgr = memory.NewManager(db, neo4jClient.Driver(), log, cfg.VectorStoreEnabled, cfg.EvoGraphEnabled)
	} else {
		memMgr = memory.NewManager(db, nil, log, cfg.VectorStoreEnabled, false)
	}
	log.Info("memory manager initialised",
		zap.Bool("evograph", cfg.EvoGraphEnabled && neo4jClient != nil),
		zap.Bool("vector", cfg.VectorStoreEnabled),
	)

	// ── Langfuse tracing ──────────────────────────────────────────────────────
	langfuse := telemetry.NewLangfuse(
		cfg.LangfuseEnabled,
		cfg.LangfusePublicKey,
		cfg.LangfuseSecretKey,
		cfg.LangfuseBaseURL,
	)
	if cfg.LangfuseEnabled {
		log.Info("Langfuse tracing enabled", zap.String("url", cfg.LangfuseBaseURL))
	}

	// ── LLM providers ─────────────────────────────────────────────────────────
	log.Info("initialising LLM providers")
	llmMgr := llm.NewManager(log).WithTracer(langfuse)

	if cfg.AnthropicAPIKey != "" {
		llmMgr.Register(llm.NewAnthropic(cfg.AnthropicAPIKey, cfg.AnthropicBaseURL))
		log.Info("registered provider: anthropic")
	}
	if cfg.OpenAIAPIKey != "" {
		llmMgr.Register(llm.NewOpenAI(cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, "openai"))
		log.Info("registered provider: openai")
	}
	if cfg.OpenRouterAPIKey != "" {
		llmMgr.Register(llm.NewOpenRouter(cfg.OpenRouterAPIKey))
		log.Info("registered provider: openrouter")
	}
	if cfg.DeepSeekAPIKey != "" {
		llmMgr.Register(llm.NewDeepSeek(cfg.DeepSeekAPIKey))
		log.Info("registered provider: deepseek")
	}
	if cfg.OllamaBaseURL != "" {
		llmMgr.Register(llm.NewOllama(cfg.OllamaBaseURL))
		log.Info("registered provider: ollama")
	}

	// ── MCP servers ────────────────────────────────────────────────────────────
	log.Info("initialising MCP servers")
	mcpMgr := mcp.NewManager(log)
	if cfg.MCPNaabuURL != "" {
		mcpMgr.Register("naabu", cfg.MCPNaabuURL)
	}
	if cfg.MCPSQLMapURL != "" {
		mcpMgr.Register("sqlmap", cfg.MCPSQLMapURL)
	}
	if cfg.MCPNucleiURL != "" {
		mcpMgr.Register("nuclei", cfg.MCPNucleiURL)
	}
	if cfg.MCPMetasploitURL != "" {
		mcpMgr.Register("metasploit", cfg.MCPMetasploitURL)
	}

	// Discover tools in background
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		mcpMgr.DiscoverTools(ctx)
	}()

	// ── Docker + Tool registry ─────────────────────────────────────────────────
	var dockerExec *docker.Executor
	dockerClient, dockerErr := docker.NewClient(cfg.DockerSocket)
	if dockerErr != nil {
		log.Warn("docker unavailable — shell tool disabled", zap.Error(dockerErr))
	} else {
		dockerExec = docker.NewExecutor(dockerClient, cfg.KaliContainerName, log)
		log.Info("docker executor initialised", zap.String("container", cfg.KaliContainerName))
	}

	toolsExecutor := tools.NewExecutor(mcpMgr, dockerExec, log)
	log.Info("tool registry initialised", zap.Strings("tools", toolsExecutor.Registry().All()))

	// ── WebSocket hub ─────────────────────────────────────────────────────────
	hub := ws.NewHub(log)

	// ── Flow engine ───────────────────────────────────────────────────────────
	taskRunner := flow.NewTaskRunner(db, llmMgr, toolsExecutor.Registry(), memMgr, hub, cfg, log)
	flowEngine := flow.NewFlowEngine(db, taskRunner, hub, log)
	log.Info("flow engine initialised")

	// ── HTTP router ───────────────────────────────────────────────────────────
	deps := &handlers.Deps{
		Config:     cfg,
		DB:         db,
		LLMMgr:     llmMgr,
		MCPMgr:     mcpMgr,
		MemMgr:     memMgr,
		Hub:        hub,
		FlowEngine: flowEngine,
		Log:        log,
	}
	router := api.Setup(deps, hub, cfg.CORSOrigin, log)

	// ── HTTP server ───────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.ServerHost, cfg.ServerPort),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start plain HTTP server in background
	go func() {
		log.Info("HTTP server listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server error", zap.Error(err))
		}
	}()

	// ── mTLS listener for worker nodes ────────────────────────────────────────
	// When WORKER_MTLS_ENABLED=true, start a second TLS listener on :8443 (or
	// WORKER_MTLS_PORT) that requires client certificates from worker nodes.
	// Workers connect to this port instead of the plain HTTP port.
	var mtlsSrv *http.Server
	if cfg.WorkerMTLSEnabled && mtls.IsEnabled(cfg.WorkerTLSCACert, cfg.WorkerTLSCert, cfg.WorkerTLSKey) {
		tlsCfg, tlsErr := mtls.NewServerTLSConfig(mtls.Config{
			CACertPath: cfg.WorkerTLSCACert,
			CertPath:   cfg.WorkerTLSCert,
			KeyPath:    cfg.WorkerTLSKey,
		})
		if tlsErr != nil {
			log.Fatal("worker mTLS config failed", zap.Error(tlsErr))
		}

		mtlsAddr := fmt.Sprintf("%s:8443", cfg.ServerHost)
		mtlsSrv = &http.Server{
			Addr:         mtlsAddr,
			Handler:      router, // same router — worker routes are part of it
			TLSConfig:    tlsCfg,
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 60 * time.Second,
			IdleTimeout:  120 * time.Second,
		}
		go func() {
			log.Info("mTLS worker listener active",
				zap.String("addr", mtlsAddr),
				zap.String("ca", cfg.WorkerTLSCACert),
			)
			// ListenAndServeTLS with empty cert/key paths — the cert is already
			// embedded in srv.TLSConfig, so pass empty strings here.
			if err := mtlsSrv.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
				log.Error("mTLS server error", zap.Error(err))
			}
		}()
	} else if cfg.WorkerMTLSEnabled {
		log.Warn("WORKER_MTLS_ENABLED=true but cert/key paths are incomplete — mTLS disabled",
			zap.String("ca", cfg.WorkerTLSCACert),
			zap.String("cert", cfg.WorkerTLSCert),
			zap.String("key", cfg.WorkerTLSKey),
		)
	}

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("shutdown error", zap.Error(err))
	}
	if mtlsSrv != nil {
		if err := mtlsSrv.Shutdown(ctx); err != nil {
			log.Error("mTLS server shutdown error", zap.Error(err))
		}
	}

	// Close MCP SSE connections
	mcpMgr.Close()

	// Flush any buffered Langfuse events before exit
	langfuse.Flush(ctx)

	if neo4jClient != nil {
		_ = neo4jClient.Close(ctx)
	}

	log.Info("shutdown complete")
}

// buildLogger creates a zap logger with the given log level.
func buildLogger(level string) *zap.Logger {
	var zapLevel zapcore.Level
	switch level {
	case "debug":
		zapLevel = zapcore.DebugLevel
	case "warn":
		zapLevel = zapcore.WarnLevel
	case "error":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	cfg := zap.NewProductionConfig()
	cfg.Level = zap.NewAtomicLevelAt(zapLevel)
	cfg.EncoderConfig.TimeKey = "time"
	cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	log, _ := cfg.Build()
	return log
}

// seedAdmin creates the default admin user if it doesn't exist.
func seedAdmin(db *gorm.DB, cfg *config.Config) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	// Use INSERT ... ON CONFLICT DO NOTHING to be idempotent
	return db.Exec(
		"INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 'admin', NOW(), NOW()) ON CONFLICT (email) DO NOTHING",
		cfg.AdminEmail, string(hash),
	).Error
}
