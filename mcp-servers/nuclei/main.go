// MCP server wrapping Nuclei vulnerability scanner.
// Exposes tools: nuclei_scan, nuclei_list_templates
package main

import (
	"context"
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
		port = "8002"
	}

	s := server.NewMCPServer("pentagron-nuclei", "1.0.0",
		server.WithToolCapabilities(true),
	)

	// ── nuclei_scan tool ──────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("nuclei_scan",
		mcp.WithDescription("Run Nuclei template-based vulnerability scan against a target."),
		mcp.WithString("target", mcp.Required(), mcp.Description("Target URL or IP")),
		mcp.WithString("templates", mcp.Description("Template tags e.g. 'cve,rce,sqli'")),
		mcp.WithString("severity", mcp.Description("Minimum severity: critical|high|medium|low|info")),
		mcp.WithNumber("timeout", mcp.Description("Timeout in seconds per template (default 30)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		target := req.Params.Arguments["target"].(string)

		args := []string{
			"-u", target,
			"-json",
			"-silent",
			"-no-color",
		}

		if tags, ok := req.Params.Arguments["templates"].(string); ok && tags != "" {
			args = append(args, "-tags", tags)
		}
		if sev, ok := req.Params.Arguments["severity"].(string); ok && sev != "" {
			args = append(args, "-severity", sev)
		}

		output, err := runCommand(ctx, "nuclei", args...)
		if err != nil && output == "" {
			return mcp.NewToolResultError(fmt.Sprintf("nuclei error: %v", err)), nil
		}

		if output == "" {
			return mcp.NewToolResultText("No vulnerabilities found."), nil
		}

		// Truncate output to avoid overwhelming the context window
		const maxOut = 8000
		if len(output) > maxOut {
			output = output[:maxOut] + "\n... [truncated, use severity filter to narrow results]"
		}

		return mcp.NewToolResultText(output), nil
	})

	// ── nuclei_list_templates tool ────────────────────────────────────────────
	s.AddTool(mcp.NewTool("nuclei_list_templates",
		mcp.WithDescription("List available Nuclei templates filtered by tags or severity."),
		mcp.WithString("tags", mcp.Description("Filter by tags e.g. 'cve,rce'")),
		mcp.WithString("severity", mcp.Description("Filter by severity")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := []string{"-list", "-silent"}

		if tags, ok := req.Params.Arguments["tags"].(string); ok && tags != "" {
			args = append(args, "-tags", tags)
		}

		output, err := runCommand(ctx, "nuclei", args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("list error: %v", err)), nil
		}

		lines := strings.Split(output, "\n")
		if len(lines) > 100 {
			lines = lines[:100]
			lines = append(lines, fmt.Sprintf("... and %d more templates", len(lines)-100))
		}

		return mcp.NewToolResultText(strings.Join(lines, "\n")), nil
	})

	log.Printf("Nuclei MCP server starting on :%s", port)
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
