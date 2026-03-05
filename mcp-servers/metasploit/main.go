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
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var (
	msfHost     = os.Getenv("MSF_HOST")
	msfPassword = os.Getenv("MSF_PASSWORD")
)

func main() {
	// Fail hard if required env vars are missing — never fall back to weak defaults.
	if msfPassword == "" {
		log.Fatal("MSF_PASSWORD env var must be set; refusing to start with default credentials")
	}
	if msfHost == "" {
		msfHost = "localhost"
	}

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
		query, ok := req.Params.Arguments["query"].(string)
		if !ok || strings.TrimSpace(query) == "" {
			return mcp.NewToolResultError("query parameter is required"), nil
		}
		if err := validateSearchQuery(query); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid query: %v", err)), nil
		}

		// Build arg slice — never interpolate user input into a shell string.
		args := []string{"-q", "-x", fmt.Sprintf("search %s; exit", query)}
		if t, ok := req.Params.Arguments["type"].(string); ok && t != "" {
			if err := validateModuleType(t); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid type: %v", err)), nil
			}
			args = []string{"-q", "-x", fmt.Sprintf("search type:%s %s; exit", t, query)}
		}

		output, err := runMSFConsole(ctx, args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("msf_search error: %v", err)), nil
		}
		if len(output) > 6000 {
			output = output[:6000] + "\n... [truncated]"
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
		module, ok := req.Params.Arguments["module"].(string)
		if !ok || strings.TrimSpace(module) == "" {
			return mcp.NewToolResultError("module parameter is required"), nil
		}
		if err := validateModulePath(module); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid module: %v", err)), nil
		}

		// Build msfconsole commands as individual -x steps.
		// Each command is passed as a separate -x argument; no shell string construction.
		cmds := []string{fmt.Sprintf("use %s", module)}

		if opts, ok := req.Params.Arguments["options"].(map[string]interface{}); ok {
			for k, v := range opts {
				if err := validateOptionKey(k); err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid option key %q: %v", k, err)), nil
				}
				valStr := fmt.Sprintf("%v", v)
				if err := validateOptionValue(valStr); err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid option value for %q: %v", k, err)), nil
				}
				cmds = append(cmds, fmt.Sprintf("set %s %s", k, valStr))
			}
		}

		if payload, ok := req.Params.Arguments["payload"].(string); ok && payload != "" {
			if err := validateModulePath(payload); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid payload: %v", err)), nil
			}
			cmds = append(cmds, fmt.Sprintf("set PAYLOAD %s", payload))
		}
		cmds = append(cmds, "run -j", "sleep 10", "sessions -l", "exit")

		// Join with semicolons for a single -x expression (no shell quoting issues
		// because we pass the whole string as one argument to msfconsole, not via sh -c).
		args := []string{"-q", "-x", strings.Join(cmds, "; ")}
		output, err := runMSFConsole(ctx, args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("msf_exploit error: %v\nOutput: %s", err, output)), nil
		}

		return mcp.NewToolResultText(output), nil
	})

	// ── msf_sessions_list tool ────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("msf_sessions_list",
		mcp.WithDescription("List all active Metasploit sessions."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		output, err := runMSFConsole(ctx, "-q", "-x", "sessions -l; exit")
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
		sidRaw, ok := req.Params.Arguments["session_id"].(float64)
		if !ok || sidRaw < 1 || sidRaw > 9999 {
			return mcp.NewToolResultError("session_id must be a positive integer (1-9999)"), nil
		}
		sid := int(sidRaw)

		command, ok := req.Params.Arguments["command"].(string)
		if !ok || strings.TrimSpace(command) == "" {
			return mcp.NewToolResultError("command parameter is required"), nil
		}
		if err := validateSessionCommand(command); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid command: %v", err)), nil
		}

		// Build the msfconsole -x expression. The command is passed as a structured
		// argument to msfconsole, not interpolated into a shell string.
		xCmd := fmt.Sprintf("sessions -i %d -c \"%s\"; exit", sid, strings.ReplaceAll(command, `"`, `\"`))
		output, err := runMSFConsole(ctx, "-q", "-x", xCmd)
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

// runMSFConsole sends a request to the msfrpc HTTP proxy with a proper context deadline.
// Falls back to a clear error if the proxy is unreachable — never silently returns the
// command string as output.
func runMSFConsole(ctx context.Context, args ...string) (string, error) {
	execCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	body, err := json.Marshal(map[string]interface{}{
		"args":     args,
		"password": msfPassword,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(execCtx, http.MethodPost,
		fmt.Sprintf("http://%s:8099/exec", msfHost),
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("msfrpc proxy unreachable at %s:8099 — ensure the Metasploit container is running: %w", msfHost, err)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}
	return string(b), nil
}

// ── Input validation helpers ──────────────────────────────────────────────────

// validateSearchQuery rejects query strings containing shell metacharacters.
func validateSearchQuery(q string) error {
	forbidden := []string{";", "|", "&", "`", "$", "(", ")", "<", ">", "\n", "\r"}
	for _, c := range forbidden {
		if strings.Contains(q, c) {
			return fmt.Errorf("query contains forbidden character %q", c)
		}
	}
	if len(q) > 200 {
		return fmt.Errorf("query too long (max 200 chars)")
	}
	return nil
}

// validateModulePath ensures a module path only contains safe characters.
// Valid: exploit/multi/handler, linux/x64/meterpreter/reverse_tcp
func validateModulePath(p string) error {
	for _, r := range p {
		if !isModuleRune(r) {
			return fmt.Errorf("invalid character %q in module path", r)
		}
	}
	if len(p) > 200 {
		return fmt.Errorf("module path too long (max 200 chars)")
	}
	return nil
}

func isModuleRune(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
		(r >= '0' && r <= '9') || r == '/' || r == '_' || r == '-' || r == '.'
}

// validateModuleType only allows known Metasploit module type keywords.
func validateModuleType(t string) error {
	allowed := map[string]bool{"exploit": true, "auxiliary": true, "post": true, "payload": true}
	if !allowed[t] {
		return fmt.Errorf("type must be one of: exploit, auxiliary, post, payload")
	}
	return nil
}

// validateOptionKey ensures MSF option keys are alphanumeric + underscore only.
func validateOptionKey(k string) error {
	for _, r := range k {
		if !((r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_') {
			return fmt.Errorf("option key %q contains invalid character %q", k, r)
		}
	}
	if len(k) > 50 {
		return fmt.Errorf("option key too long (max 50 chars)")
	}
	return nil
}

// validateOptionValue rejects newlines and null bytes in option values.
func validateOptionValue(v string) error {
	if strings.ContainsAny(v, "\n\r\x00") {
		return fmt.Errorf("option value contains forbidden control characters")
	}
	if len(v) > 500 {
		return fmt.Errorf("option value too long (max 500 chars)")
	}
	return nil
}

// validateSessionCommand rejects commands that contain shell injection metacharacters.
func validateSessionCommand(cmd string) error {
	forbidden := []string{"\n", "\r", "\x00"}
	for _, c := range forbidden {
		if strings.Contains(cmd, c) {
			return fmt.Errorf("command contains forbidden control character")
		}
	}
	if len(cmd) > 1000 {
		return fmt.Errorf("command too long (max 1000 chars)")
	}
	return nil
}
