// MCP server wrapping Naabu port scanner.
// Exposes tools: port_scan, cdn_detect
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

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
		mcp.WithNumber("rate", mcp.Description("Packets per second (default 1000)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		target := req.Params.Arguments["target"].(string)
		ports := "top-1000"
		if p, ok := req.Params.Arguments["ports"].(string); ok && p != "" {
			ports = p
		}

		args := []string{"-host", target, "-p", ports, "-json", "-silent"}
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
		target := req.Params.Arguments["target"].(string)

		// Use naabu with CDN detection
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

func runCommand(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var sb strings.Builder
	cmd.Stdout = &sb
	cmd.Stderr = &sb
	err := cmd.Run()
	return sb.String(), err
}

func init() {
	_ = json.Marshal // ensure json is imported
}
