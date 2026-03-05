// MCP server wrapping SQLMap for SQL injection testing.
// Exposes tools: sqli_test, sqli_dump
package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// reIdentifier matches safe SQL identifiers (db/table/column names).
var reIdentifier = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// blockedHosts is a list of private/internal host prefixes to block SSRF.
var blockedHosts = []string{
	"localhost", "127.", "10.", "192.168.",
	"172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.",
	"172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
	"172.28.", "172.29.", "172.30.", "172.31.",
	"169.254.", "::1", "[::1]",
}

func validateURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("URL must not be empty")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("malformed URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("URL scheme must be http or https, got %q", u.Scheme)
	}
	if u.Host == "" {
		return fmt.Errorf("URL must include a host")
	}
	host := strings.ToLower(u.Hostname())
	for _, b := range blockedHosts {
		if strings.HasPrefix(host, b) || host == strings.TrimSuffix(b, ".") {
			return fmt.Errorf("target %q is a private/internal address and is not permitted (SSRF prevention)", host)
		}
	}
	return nil
}

func validateIdentifier(name, label string) error {
	if name == "" {
		return nil
	}
	if len(name) > 128 {
		return fmt.Errorf("%s too long (max 128 chars)", label)
	}
	if !reIdentifier.MatchString(name) {
		return fmt.Errorf("%s must only contain alphanumeric characters and underscores", label)
	}
	return nil
}

func validateColumns(cols string) error {
	if cols == "" {
		return nil
	}
	for _, col := range strings.Split(cols, ",") {
		if err := validateIdentifier(strings.TrimSpace(col), "column"); err != nil {
			return err
		}
	}
	return nil
}

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
		rawURL, ok := req.Params.Arguments["url"].(string)
		if !ok {
			return mcp.NewToolResultError("url parameter is required"), nil
		}
		if err := validateURL(rawURL); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid url: %v", err)), nil
		}

		args := []string{
			"-u", rawURL,
			"--batch",
			"--random-agent",
			"--timeout=30",
		}

		if level, ok := req.Params.Arguments["level"].(float64); ok {
			l := int(level)
			if l < 1 || l > 5 {
				return mcp.NewToolResultError("level must be between 1 and 5"), nil
			}
			args = append(args, fmt.Sprintf("--level=%d", l))
		}
		if risk, ok := req.Params.Arguments["risk"].(float64); ok {
			r := int(risk)
			if r < 1 || r > 3 {
				return mcp.NewToolResultError("risk must be between 1 and 3"), nil
			}
			args = append(args, fmt.Sprintf("--risk=%d", r))
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
		rawURL, ok := req.Params.Arguments["url"].(string)
		if !ok {
			return mcp.NewToolResultError("url parameter is required"), nil
		}
		if err := validateURL(rawURL); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid url: %v", err)), nil
		}

		args := []string{
			"-u", rawURL,
			"--batch",
			"--random-agent",
			"--timeout=60",
			"--dump",
		}

		if db, ok := req.Params.Arguments["db"].(string); ok && db != "" {
			if err := validateIdentifier(db, "db"); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid db: %v", err)), nil
			}
			args = append(args, "-D", db)
		}
		if table, ok := req.Params.Arguments["table"].(string); ok && table != "" {
			if err := validateIdentifier(table, "table"); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid table: %v", err)), nil
			}
			args = append(args, "-T", table)
		}
		if cols, ok := req.Params.Arguments["columns"].(string); ok && cols != "" {
			if err := validateColumns(cols); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid columns: %v", err)), nil
			}
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
