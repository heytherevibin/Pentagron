// MCP server wrapping SQLMap for SQL injection testing.
// Exposes tools: sqli_test, sqli_dump
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func main() {
	port := os.Getenv("MCP_PORT")
	if port == "" {
		port = "8001"
	}

	s := server.NewMCPServer("pentagron-sqlmap", "1.0.0",
		server.WithToolCapabilities(true),
	)

	// ── sqli_test tool ────────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("sqli_test",
		mcp.WithDescription("Test a URL for SQL injection vulnerabilities using SQLMap."),
		mcp.WithString("url", mcp.Required(), mcp.Description("Target URL with parameter e.g. 'http://target/page?id=1'")),
		mcp.WithNumber("level", mcp.Description("Test level 1-5 (default 1)")),
		mcp.WithNumber("risk", mcp.Description("Risk level 1-3 (default 1)")),
		mcp.WithBoolean("forms", mcp.Description("Test HTML forms automatically")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		url := req.Params.Arguments["url"].(string)

		args := []string{
			"-u", url,
			"--batch",      // non-interactive
			"--random-agent",
			"--timeout=30",
		}

		if level, ok := req.Params.Arguments["level"].(float64); ok {
			args = append(args, fmt.Sprintf("--level=%d", int(level)))
		}
		if risk, ok := req.Params.Arguments["risk"].(float64); ok {
			args = append(args, fmt.Sprintf("--risk=%d", int(risk)))
		}
		if forms, ok := req.Params.Arguments["forms"].(bool); ok && forms {
			args = append(args, "--forms")
		}

		output, err := runSQLMap(ctx, args...)
		if err != nil && output == "" {
			return mcp.NewToolResultError(fmt.Sprintf("sqlmap error: %v", err)), nil
		}

		// Extract relevant section
		if idx := strings.Index(output, "---"); idx >= 0 {
			output = output[idx:]
		}
		if len(output) > 6000 {
			output = output[:6000] + "\n... [truncated]"
		}

		return mcp.NewToolResultText(output), nil
	})

	// ── sqli_dump tool ────────────────────────────────────────────────────────
	s.AddTool(mcp.NewTool("sqli_dump",
		mcp.WithDescription("Dump database contents from a confirmed SQL injection point."),
		mcp.WithString("url", mcp.Required(), mcp.Description("Vulnerable URL")),
		mcp.WithString("db", mcp.Description("Target database name")),
		mcp.WithString("table", mcp.Description("Target table name")),
		mcp.WithString("columns", mcp.Description("Comma-separated column names to dump")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		url := req.Params.Arguments["url"].(string)

		args := []string{
			"-u", url,
			"--batch",
			"--random-agent",
			"--timeout=60",
			"--dump",
		}

		if db, ok := req.Params.Arguments["db"].(string); ok && db != "" {
			args = append(args, "-D", db)
		}
		if table, ok := req.Params.Arguments["table"].(string); ok && table != "" {
			args = append(args, "-T", table)
		}
		if cols, ok := req.Params.Arguments["columns"].(string); ok && cols != "" {
			args = append(args, "-C", cols)
		}

		output, err := runSQLMap(ctx, args...)
		if err != nil && output == "" {
			return mcp.NewToolResultError(fmt.Sprintf("sqli_dump error: %v", err)), nil
		}

		if len(output) > 8000 {
			output = output[:8000] + "\n... [truncated]"
		}

		return mcp.NewToolResultText(output), nil
	})

	log.Printf("SQLMap MCP server starting on :%s", port)
	sse := server.NewSSEServer(s, server.WithBaseURL(fmt.Sprintf("http://0.0.0.0:%s", port)))
	if err := sse.Start(fmt.Sprintf("0.0.0.0:%s", port)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func runSQLMap(ctx context.Context, args ...string) (string, error) {
	execCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(execCtx, "sqlmap", args...)
	var sb strings.Builder
	cmd.Stdout = &sb
	cmd.Stderr = &sb
	err := cmd.Run()
	return sb.String(), err
}
