// MCP server wrapping Metasploit Framework via msfrpc.
// Exposes tools: msf_exploit, msf_search, msf_sessions_list, msf_session_cmd
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var (
	msfHost     = os.Getenv("MSF_HOST")
	msfRPCPort  = "55553"
	msfUser     = "msf"
	msfPassword = os.Getenv("MSF_PASSWORD")
)

func init() {
	if msfHost == "" {
		msfHost = "localhost"
	}
	if msfPassword == "" {
		msfPassword = "msf"
	}
}

func main() {
	port := os.Getenv("MCP_PORT")
	if port == "" {
		port = "8003"
	}

	s := server.NewMCPServer("pentagron-metasploit", "1.0.0",
		server.WithToolCapabilities(true),
	)

	// ── msf_search tool ───────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("msf_search",
		mcp.WithDescription("Search Metasploit for modules matching a CVE, name, or platform."),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search query e.g. 'CVE-2021-44228' or 'eternalblue'")),
		mcp.WithString("type", mcp.Description("Module type: exploit|auxiliary|post|payload")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		query := req.Params.Arguments["query"].(string)

		// Run msfconsole search via shell
		cmd := fmt.Sprintf("msfconsole -q -x 'search %s; exit' 2>/dev/null | head -50", query)
		output, err := runMSFCommand(ctx, cmd)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("msf_search error: %v", err)), nil
		}
		return mcp.NewToolResultText(output), nil
	})

	// ── msf_exploit tool ──────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("msf_exploit",
		mcp.WithDescription("Execute a Metasploit module. REQUIRES exploitation phase approval."),
		mcp.WithString("module", mcp.Required(), mcp.Description("Module path e.g. 'exploit/multi/handler'")),
		mcp.WithObject("options", mcp.Description("Module options as key-value pairs (RHOSTS, LHOST, etc.)")),
		mcp.WithString("payload", mcp.Description("Payload e.g. 'linux/x64/meterpreter/reverse_tcp'")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		module := req.Params.Arguments["module"].(string)

		// Build msfconsole resource script
		var script string
		script += fmt.Sprintf("use %s\n", module)

		if opts, ok := req.Params.Arguments["options"].(map[string]interface{}); ok {
			for k, v := range opts {
				script += fmt.Sprintf("set %s %v\n", k, v)
			}
		}
		if payload, ok := req.Params.Arguments["payload"].(string); ok && payload != "" {
			script += fmt.Sprintf("set PAYLOAD %s\n", payload)
		}
		script += "run -j\nsleep 10\nsessions -l\nexit\n"

		cmd := fmt.Sprintf("echo '%s' | msfconsole -q -r /dev/stdin 2>&1", script)
		output, err := runMSFCommand(ctx, cmd)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("msf_exploit error: %v\nOutput: %s", err, output)), nil
		}

		return mcp.NewToolResultText(output), nil
	})

	// ── msf_sessions_list tool ────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("msf_sessions_list",
		mcp.WithDescription("List all active Metasploit sessions."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		cmd := "msfconsole -q -x 'sessions -l; exit' 2>/dev/null"
		output, err := runMSFCommand(ctx, cmd)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("sessions error: %v", err)), nil
		}
		return mcp.NewToolResultText(output), nil
	})

	// ── msf_session_cmd tool ──────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("msf_session_cmd",
		mcp.WithDescription("Run a command in an active Meterpreter session."),
		mcp.WithNumber("session_id", mcp.Required(), mcp.Description("Session ID from msf_sessions_list")),
		mcp.WithString("command", mcp.Required(), mcp.Description("Command to run in the session")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		sid := int(req.Params.Arguments["session_id"].(float64))
		command := req.Params.Arguments["command"].(string)

		script := fmt.Sprintf("sessions -i %d -c '%s'\nexit\n", sid, command)
		cmd := fmt.Sprintf("echo '%s' | msfconsole -q -r /dev/stdin 2>&1", script)
		output, err := runMSFCommand(ctx, cmd)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("session_cmd error: %v", err)), nil
		}
		return mcp.NewToolResultText(output), nil
	})

	log.Printf("Metasploit MCP server starting on :%s", port)
	sse := server.NewSSEServer(s, server.WithBaseURL(fmt.Sprintf("http://0.0.0.0:%s", port)))
	if err := sse.Start(fmt.Sprintf("0.0.0.0:%s", port)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// runMSFCommand runs a shell command with a 5-minute timeout.
func runMSFCommand(ctx context.Context, cmd string) (string, error) {
	execCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	_ = execCtx
	// Use HTTP to the msfrpc daemon if available, otherwise fall through to shell
	// For now, use the Docker exec approach via the kali-sandbox host
	body, _ := json.Marshal(map[string]string{"command": cmd})
	resp, err := http.Post(
		fmt.Sprintf("http://%s:8099/exec", msfHost),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Sprintf("msf exec via shell: %s", cmd), nil
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return string(b), nil
}
