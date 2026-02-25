package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/docker"
	"github.com/pentagron/pentagron/pkg/mcp"
)

// Executor routes tool calls to either MCP servers or the Docker exec backend.
type Executor struct {
	mcpMgr    *mcp.Manager
	dockerExec *docker.Executor
	log       *zap.Logger
	registry  *Registry
}

// NewExecutor creates a new Executor and registers all built-in tools.
func NewExecutor(mcpMgr *mcp.Manager, dockerExec *docker.Executor, log *zap.Logger) *Executor {
	e := &Executor{
		mcpMgr:    mcpMgr,
		dockerExec: dockerExec,
		log:       log,
		registry:  NewRegistry(),
	}
	e.registerBuiltins()
	return e
}

// Registry returns the underlying tool registry.
func (e *Executor) Registry() *Registry {
	return e.registry
}

// registerBuiltins wires up all tool implementations to the registry.
func (e *Executor) registerBuiltins() {
	// ── Finish tool (always available) ───────────────────────────────────────
	e.registry.Register(Tool{
		Name:        "finish",
		Description: "Call this when you have completed the task. Provide your final answer.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"answer": {"type": "string", "description": "Your final answer or summary"}
			},
			"required": ["answer"]
		}`),
		Execute: func(_ context.Context, input json.RawMessage) (string, error) {
			var v struct{ Answer string }
			_ = json.Unmarshal(input, &v)
			return v.Answer, nil
		},
	})

	// ── Docker exec tool (any shell command in Kali sandbox) ─────────────────
	e.registry.Register(Tool{
		Name:        "shell",
		Description: "Execute a shell command inside the Kali Linux sandbox. Use for any tool not available via MCP.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"command": {"type": "string", "description": "Shell command to execute"},
				"timeout": {"type": "integer", "description": "Timeout in seconds (default 60)"}
			},
			"required": ["command"]
		}`),
		AgentTypes: []string{"pentester", "coder", "recon", "post_exploitation"},
		Execute:    e.shellTool,
	})

	// ── MCP — Naabu port scan ─────────────────────────────────────────────────
	e.registry.Register(Tool{
		Name:        "port_scan",
		Description: "Scan ports on a target host using Naabu. Returns open ports and services.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"target": {"type": "string", "description": "Target IP or hostname"},
				"ports":  {"type": "string", "description": "Port range e.g. '1-1000' or 'top-100'"},
				"rate":   {"type": "integer", "description": "Packets per second (default 1000)"}
			},
			"required": ["target"]
		}`),
		AgentTypes: []string{"pentester", "recon"},
		Phases:     []string{"recon", "analysis"},
		Execute:    e.mcpTool("naabu", "port_scan"),
	})

	// ── MCP — Nuclei vulnerability scan ─────────────────────────────────────
	e.registry.Register(Tool{
		Name:        "vuln_scan",
		Description: "Run Nuclei template-based vulnerability scan against a target URL or IP.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"target":    {"type": "string", "description": "Target URL or IP"},
				"templates": {"type": "string", "description": "Template tags e.g. 'cve,rce,sqli'"},
				"severity":  {"type": "string", "description": "Minimum severity: critical|high|medium|low"}
			},
			"required": ["target"]
		}`),
		AgentTypes: []string{"pentester", "recon"},
		Phases:     []string{"recon", "analysis", "exploitation"},
		Execute:    e.mcpTool("nuclei", "nuclei_scan"),
	})

	// ── MCP — Metasploit exploit ─────────────────────────────────────────────
	e.registry.Register(Tool{
		Name:        "msf_exploit",
		Description: "Execute a Metasploit module against a target. Requires exploitation phase approval.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"module":  {"type": "string", "description": "Metasploit module path e.g. 'exploit/multi/handler'"},
				"options": {"type": "object", "description": "Module options (RHOSTS, LHOST, etc.)"},
				"payload": {"type": "string", "description": "Payload e.g. 'linux/x64/meterpreter/reverse_tcp'"}
			},
			"required": ["module"]
		}`),
		AgentTypes: []string{"pentester"},
		Phases:     []string{"exploitation"},
		Execute:    e.mcpTool("metasploit", "msf_exploit"),
	})

	// ── MCP — Metasploit session management ─────────────────────────────────
	e.registry.Register(Tool{
		Name:        "msf_sessions_list",
		Description: "List all active Metasploit sessions (Meterpreter and shell).",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {}
		}`),
		AgentTypes: []string{"pentester", "post_exploitation"},
		Phases:     []string{"exploitation", "post_exploitation"},
		Execute:    e.mcpTool("metasploit", "msf_sessions_list"),
	})

	e.registry.Register(Tool{
		Name:        "msf_session_cmd",
		Description: "Run a command in an active Metasploit session by session ID.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"session_id": {"type": "integer", "description": "Metasploit session ID"},
				"command":    {"type": "string", "description": "Command to run in the session"}
			},
			"required": ["session_id", "command"]
		}`),
		AgentTypes: []string{"pentester", "post_exploitation"},
		Phases:     []string{"exploitation", "post_exploitation"},
		Execute:    e.mcpTool("metasploit", "msf_session_cmd"),
	})

	// ── MCP — SQLMap ─────────────────────────────────────────────────────────
	e.registry.Register(Tool{
		Name:        "sqli_test",
		Description: "Test a URL for SQL injection vulnerabilities using SQLMap.",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"url":    {"type": "string", "description": "Target URL with parameter to test"},
				"level":  {"type": "integer", "description": "Test level 1-5 (default 1)"},
				"risk":   {"type": "integer", "description": "Risk level 1-3 (default 1)"},
				"dump":   {"type": "boolean", "description": "Dump database contents if vulnerable"}
			},
			"required": ["url"]
		}`),
		AgentTypes: []string{"pentester"},
		Phases:     []string{"analysis", "exploitation"},
		Execute:    e.mcpTool("sqlmap", "sqli_test"),
	})
}

// shellTool executes a command in the Kali Docker sandbox.
func (e *Executor) shellTool(ctx context.Context, input json.RawMessage) (string, error) {
	var v struct {
		Command string `json:"command"`
		Timeout int    `json:"timeout"`
	}
	if err := json.Unmarshal(input, &v); err != nil {
		return "", fmt.Errorf("shell: invalid input: %w", err)
	}
	if v.Timeout == 0 {
		v.Timeout = 60
	}
	e.log.Info("shell tool", zap.String("command", v.Command))
	return e.dockerExec.Exec(ctx, v.Command, v.Timeout)
}

// mcpTool returns an Execute func that calls the named MCP server + tool.
func (e *Executor) mcpTool(serverName, toolName string) func(context.Context, json.RawMessage) (string, error) {
	return func(ctx context.Context, input json.RawMessage) (string, error) {
		return e.mcpMgr.Call(ctx, serverName, toolName, input)
	}
}
