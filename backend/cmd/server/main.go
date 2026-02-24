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
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"github.com/pentagron/pentagron/pkg/ws"
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
	db, err := database.NewPostgres(cfg.PostgresDSN, cfg.LogLevel)
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

	// ── LLM providers ─────────────────────────────────────────────────────────
	log.Info("initialising LLM providers")
	llmMgr := llm.NewManager(log)

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

	// ── WebSocket hub ─────────────────────────────────────────────────────────
	hub := ws.NewHub(log)

	// ── HTTP router ───────────────────────────────────────────────────────────
	deps := &handlers.Deps{
		Config: cfg,
		DB:     db,
		LLMMgr: llmMgr,
		MCPMgr: mcpMgr,
		Log:    log,
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

	// Start in background
	go func() {
		log.Info("HTTP server listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server error", zap.Error(err))
		}
	}()

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
func seedAdmin(db interface{ Exec(string, ...interface{}) interface{ Error error } }, cfg *config.Config) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	// Use INSERT ... ON CONFLICT DO NOTHING to be idempotent
	result := db.Exec(
		"INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 'admin', NOW(), NOW()) ON CONFLICT (email) DO NOTHING",
		cfg.AdminEmail, string(hash),
	)
	return result.Error
}
