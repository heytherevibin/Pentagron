package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"net"

	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/docker"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"github.com/pentagron/pentagron/pkg/mtls"
	"github.com/pentagron/pentagron/pkg/tools"
)

// Worker is a standalone node that executes tool calls in an isolated environment.
// Designed for air-gapped deployments where the main server cannot reach the
// target network directly.
//
// Lifecycle:
//  1. Register with the server (POST /api/workers/register)
//  2. Poll for tasks every 5s (GET /api/workers/:id/tasks)
//  3. Execute the tool via the local tools.Executor
//  4. Post result back (POST /api/workers/:id/results)

var (
	serverAddr   = flag.String("server", "http://localhost:8080", "Pentagron server address")
	workerID     = flag.String("id", "", "Worker ID (generated if empty)")
	authToken    = flag.String("token", "", "Bearer token for server API auth")
	pollInterval = flag.Duration("poll", 5*time.Second, "Task poll interval")

	// mTLS flags — when all three are set the worker uses mutual TLS
	tlsCA   = flag.String("tls-ca", "", "Path to CA certificate PEM (enables mTLS)")
	tlsCert = flag.String("tls-cert", "", "Path to worker certificate PEM")
	tlsKey  = flag.String("tls-key", "", "Path to worker private key PEM")
)

func main() {
	flag.Parse()

	cfg := config.MustLoad()

	logCfg := zap.NewProductionConfig()
	log, _ := logCfg.Build()
	defer func() { _ = log.Sync() }()

	if *workerID == "" {
		h, _ := os.Hostname()
		*workerID = fmt.Sprintf("worker-%s-%d", h, time.Now().Unix())
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
	executor := tools.NewExecutor(mcpMgr, dockerExec, log)

	// ── LLM (for local execution in air-gapped mode) ──────────────────────────
	llmMgr := llm.NewManager(log)
	if cfg.OllamaBaseURL != "" {
		llmMgr.Register(llm.NewOllama(cfg.OllamaBaseURL))
	}
	_ = llmMgr // available for local inference if needed

	httpClient := buildHTTPClient(*tlsCA, *tlsCert, *tlsKey, log)
	capabilities := buildCapabilities(cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ── Register with server ───────────────────────────────────────────────────
	if err := registerWorker(ctx, httpClient, *serverAddr, *workerID, capabilities, *authToken, log); err != nil {
		log.Warn("initial registration failed — will retry on first poll", zap.Error(err))
	}

	log.Info("worker ready", zap.String("id", *workerID))

	// ── Poll loop ─────────────────────────────────────────────────────────────
	ticker := time.NewTicker(*pollInterval)
	defer ticker.Stop()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case <-quit:
			log.Info("worker shutting down")
			return
		case <-ticker.C:
			// Re-register on every poll (heartbeat)
			_ = registerWorker(ctx, httpClient, *serverAddr, *workerID, capabilities, *authToken, log)
			// Poll for a pending task
			task := pollTask(ctx, httpClient, *serverAddr, *workerID, *authToken, log)
			if task == nil {
				continue
			}
			log.Info("received task",
				zap.String("task_id", task.ID),
				zap.String("tool", task.ToolName),
			)
			go executeTask(ctx, httpClient, executor, *serverAddr, *workerID, *authToken, task, log)
		}
	}
}

// ── Types ─────────────────────────────────────────────────────────────────────

type workerTask struct {
	ID       string `json:"id"`
	ToolName string `json:"tool_name"`
	Input    string `json:"input"` // JSON string
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func registerWorker(ctx context.Context, client *http.Client, server, id string, caps []string, token string, log *zap.Logger) error {
	body := map[string]any{
		"id":           id,
		"hostname":     workerHostname(),
		"capabilities": caps,
	}
	if err := doPost(ctx, client, server+"/api/workers/register", token, body, nil); err != nil {
		log.Warn("register failed", zap.Error(err))
		return err
	}
	return nil
}

func pollTask(ctx context.Context, client *http.Client, server, id, token string, log *zap.Logger) *workerTask {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		server+"/api/workers/"+id+"/tasks", nil)
	if err != nil {
		return nil
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Warn("poll failed", zap.Error(err))
		return nil
	}
	defer func() { _ = resp.Body.Close() }()

	var result struct {
		Task *workerTask `json:"task"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}
	return result.Task
}

func executeTask(
	ctx context.Context,
	client *http.Client,
	executor *tools.Executor,
	server, id, token string,
	task *workerTask,
	log *zap.Logger,
) {
	rawInput := json.RawMessage(task.Input)
	if len(rawInput) == 0 {
		rawInput = json.RawMessage("{}")
	}

	output, execErr := executor.Registry().Execute(ctx, task.ToolName, rawInput)
	success := execErr == nil
	errMsg := ""
	if execErr != nil {
		errMsg = execErr.Error()
		log.Warn("tool execution failed",
			zap.String("tool", task.ToolName),
			zap.Error(execErr),
		)
	}

	body := map[string]any{
		"task_id": task.ID,
		"output":  output,
		"error":   errMsg,
		"success": success,
	}
	if err := doPost(ctx, client, server+"/api/workers/"+id+"/results", token, body, nil); err != nil {
		log.Warn("failed to submit task result", zap.String("task_id", task.ID), zap.Error(err))
	} else {
		log.Info("task result submitted", zap.String("task_id", task.ID), zap.Bool("success", success))
	}
}

func doPost(ctx context.Context, client *http.Client, url, token string, body any, out any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http post: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if out != nil {
		raw, _ := io.ReadAll(resp.Body)
		return json.Unmarshal(raw, out)
	}
	return nil
}

func workerHostname() string {
	h, _ := os.Hostname()
	return h
}

// buildHTTPClient returns an *http.Client configured for plain HTTP or mutual TLS.
// When all three cert paths are non-empty the client presents its certificate and
// verifies the server against the CA — enabling full mutual TLS.
func buildHTTPClient(caPath, certPath, keyPath string, log *zap.Logger) *http.Client {
	if !mtls.IsEnabled(caPath, certPath, keyPath) {
		return &http.Client{Timeout: 10 * time.Second}
	}

	tlsCfg, err := mtls.NewClientTLSConfig(mtls.Config{
		CACertPath: caPath,
		CertPath:   certPath,
		KeyPath:    keyPath,
	})
	if err != nil {
		log.Fatal("worker mTLS client config failed", zap.Error(err))
	}

	transport := &http.Transport{
		TLSClientConfig: tlsCfg,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
	}
	log.Info("worker mTLS enabled",
		zap.String("ca", caPath),
		zap.String("cert", certPath),
	)
	return &http.Client{
		Timeout:   10 * time.Second,
		Transport: transport,
	}
}

// buildCapabilities returns the list of tool namespaces available to this worker.
func buildCapabilities(cfg *config.Config) []string {
	caps := []string{"docker"} // always available if Docker is reachable
	if cfg.MCPNaabuURL != "" {
		caps = append(caps, "naabu")
	}
	if cfg.MCPNucleiURL != "" {
		caps = append(caps, "nuclei")
	}
	if cfg.MCPMetasploitURL != "" {
		caps = append(caps, "metasploit")
	}
	if cfg.MCPSQLMapURL != "" {
		caps = append(caps, "sqlmap")
	}
	return caps
}
