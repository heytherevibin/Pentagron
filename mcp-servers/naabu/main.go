// MCP server wrapping Naabu port scanner.
// Exposes tools: port_scan, cdn_detect
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// reTargetSafe matches valid hostnames and IPv4/IPv6 addresses.
// Rejects shell metacharacters, path traversal, etc.
var reTargetSafe = regexp.MustCompile(`^[a-zA-Z0-9._:\-\[\]]+$`)

// rePortRange matches valid port specs: numbers, ranges, or the "top-NNN" shorthand.
var rePortRange = regexp.MustCompile(`^(top-\d{1,5}|\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*)$`)

func validateTarget(t string) error {
	t = strings.TrimSpace(t)
	if t == "" {
		return fmt.Errorf("target must not be empty")
	}
	if len(t) > 253 {
		return fmt.Errorf("target too long (max 253 chars)")
	}
	if !reTargetSafe.MatchString(t) {
		return fmt.Errorf("target contains invalid characters — only hostnames and IP addresses are accepted")
	}
	return nil
}

func validatePortRange(p string) error {
	if p == "" {
		return nil
	}
	if !rePortRange.MatchString(p) {
		return fmt.Errorf("ports must be a valid port range (e.g. '80', '1-1000', 'top-100')")
	}
	return nil
}

func main() {
	port := os.Getenv("MCP_PORT")
	if port == "" {
		port = "8000"
	}

	s := server.NewMCPServer("pentagron-naabu", "1.0.0",
		server.WithToolCapabilities(true),
	)

	// ── port_scan tool ────────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("port_scan",
		mcp.WithDescription("Scan ports on a target host using Naabu. Returns open ports."),
		mcp.WithString("target", mcp.Required(), mcp.Description("Target IP or hostname")),
		mcp.WithString("ports", mcp.Description("Port range e.g. '1-1000' or 'top-100'")),
		mcp.WithNumber("rate", mcp.Description("Packets per second (default 1000, max 10000)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		target, ok := req.Params.Arguments["target"].(string)
		if !ok {
			return mcp.NewToolResultError("target parameter is required"), nil
		}
		if err := validateTarget(target); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid target: %v", err)), nil
		}

		ports := "top-1000"
		if p, ok := req.Params.Arguments["ports"].(string); ok && p != "" {
			if err := validatePortRange(p); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid ports: %v", err)), nil
			}
			ports = p
		}

		rate := 1000
		if r, ok := req.Params.Arguments["rate"].(float64); ok {
			rate = int(r)
			if rate < 1 || rate > 10000 {
				return mcp.NewToolResultError("rate must be between 1 and 10000"), nil
			}
		}

		args := []string{
			"-host", target,
			"-p", ports,
			"-rate", fmt.Sprintf("%d", rate),
			"-json", "-silent",
		}
		output, err := runCommand(ctx, "naabu", args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("naabu error: %v\nOutput: %s", err, output)), nil
		}

		return mcp.NewToolResultText(output), nil
	})

	// ── cdn_detect tool ───────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("cdn_detect",
		mcp.WithDescription("Detect if a target is behind a CDN or WAF (Cloudflare, Akamai, etc.)"),
		mcp.WithString("target", mcp.Required(), mcp.Description("Target hostname or IP")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		target, ok := req.Params.Arguments["target"].(string)
		if !ok {
			return mcp.NewToolResultError("target parameter is required"), nil
		}
		if err := validateTarget(target); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid target: %v", err)), nil
		}

		args := []string{"-host", target, "-cdn", "-json", "-silent"}
		output, err := runCommand(ctx, "naabu", args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("cdn_detect error: %v", err)), nil
		}

		return mcp.NewToolResultText(output), nil
	})

	log.Printf("Naabu MCP server starting on :%s", port)
	sse := server.NewSSEServer(s, server.WithBaseURL(fmt.Sprintf("http://0.0.0.0:%s", port)))
	if err := sse.Start(fmt.Sprintf("0.0.0.0:%s", port)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// runCommand executes a binary with an explicit 5-minute timeout derived from ctx.
func runCommand(ctx context.Context, name string, args ...string) (string, error) {
	execCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(execCtx, name, args...)
	var sb strings.Builder
	cmd.Stdout = &sb
	cmd.Stderr = &sb
	err := cmd.Run()
	return sb.String(), err
}
