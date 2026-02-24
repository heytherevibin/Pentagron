package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/docker"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"github.com/pentagron/pentagron/pkg/tools"
)

// Worker is a standalone node that executes tool calls in an isolated environment.
// Designed for air-gapped deployments where the main server cannot reach the
// target network directly.

var (
	serverAddr = flag.String("server", "http://localhost:8080", "Pentagron server address")
	workerID   = flag.String("id", "", "Worker ID (generated if empty)")
)

func main() {
	flag.Parse()

	cfg := config.MustLoad()

	logCfg := zap.NewProductionConfig()
	log, _ := logCfg.Build()
	defer log.Sync()

	if *workerID == "" {
		hostname, _ := os.Hostname()
		*workerID = fmt.Sprintf("worker-%s-%d", hostname, time.Now().Unix())
	}

	log.Info("starting Pentagron worker",
		zap.String("id", *workerID),
		zap.String("server", *serverAddr),
	)

	// ── Docker executor ───────────────────────────────────────────────────────
	dockerClient, err := docker.NewClient(cfg.DockerSocket)
	if err != nil {
		log.Fatal("docker client failed", zap.Error(err))
	}
	if err := dockerClient.Ping(context.Background()); err != nil {
		log.Fatal("docker not reachable", zap.Error(err))
	}
	dockerExec := docker.NewExecutor(dockerClient, cfg.KaliContainerName, log)

	// ── MCP manager ───────────────────────────────────────────────────────────
	mcpMgr := mcp.NewManager(log)
	if cfg.MCPNaabuURL != "" {
		mcpMgr.Register("naabu", cfg.MCPNaabuURL)
	}
	if cfg.MCPNucleiURL != "" {
		mcpMgr.Register("nuclei", cfg.MCPNucleiURL)
	}
	if cfg.MCPMetasploitURL != "" {
		mcpMgr.Register("metasploit", cfg.MCPMetasploitURL)
	}
	if cfg.MCPSQLMapURL != "" {
		mcpMgr.Register("sqlmap", cfg.MCPSQLMapURL)
	}

	// ── Tool executor ─────────────────────────────────────────────────────────
	_ = tools.NewExecutor(mcpMgr, dockerExec, log)

	// ── LLM (for local execution in air-gapped mode) ──────────────────────────
	llmMgr := llm.NewManager(log)
	if cfg.OllamaBaseURL != "" {
		llmMgr.Register(llm.NewOllama(cfg.OllamaBaseURL))
	}

	log.Info("worker ready", zap.String("id", *workerID))

	// ── Signal handling ────────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("worker shutting down")
}
