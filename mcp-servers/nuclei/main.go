// MCP server wrapping Nuclei vulnerability scanner.
// Exposes tools: nuclei_scan, nuclei_list_templates
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// reTargetSafe accepts hostnames, IPs, and URLs (http/https scheme prefix allowed).
var reTargetSafe = regexp.MustCompile(`^(https?://)?[a-zA-Z0-9._:\-\[\]/]+$`)

// reSeverity matches the exact set of valid Nuclei severity keywords.
var reSeverity = regexp.MustCompile(`^(critical|high|medium|low|info)(,(critical|high|medium|low|info))*$`)

// reTemplateTags allows alphanumeric tags with commas and hyphens.
var reTemplateTags = regexp.MustCompile(`^[a-zA-Z0-9,\-_]+$`)

func validateTarget(t string) error {
	t = strings.TrimSpace(t)
	if t == "" {
		return fmt.Errorf("target must not be empty")
	}
	if len(t) > 2048 {
		return fmt.Errorf("target too long")
	}
	if !reTargetSafe.MatchString(t) {
		return fmt.Errorf("target contains invalid characters")
	}
	return nil
}

func validateSeverity(s string) error {
	if s == "" {
		return nil
	}
	if !reSeverity.MatchString(s) {
		return fmt.Errorf("severity must be a comma-separated list of: critical, high, medium, low, info")
	}
	return nil
}

func validateTags(t string) error {
	if t == "" {
		return nil
	}
	if !reTemplateTags.MatchString(t) {
		return fmt.Errorf("tags must only contain alphanumeric characters, commas, hyphens, or underscores")
	}
	return nil
}

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
		mcp.WithNumber("timeout", mcp.Description("Timeout in seconds per template (default 30, max 300)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		target, ok := req.Params.Arguments["target"].(string)
		if !ok {
			return mcp.NewToolResultError("target parameter is required"), nil
		}
		if err := validateTarget(target); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid target: %v", err)), nil
		}

		args := []string{
			"-u", target,
			"-json",
			"-silent",
			"-no-color",
		}

		if tags, ok := req.Params.Arguments["templates"].(string); ok && tags != "" {
			if err := validateTags(tags); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid templates: %v", err)), nil
			}
			args = append(args, "-tags", tags)
		}
		if sev, ok := req.Params.Arguments["severity"].(string); ok && sev != "" {
			if err := validateSeverity(sev); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid severity: %v", err)), nil
			}
			args = append(args, "-severity", sev)
		}
		if t, ok := req.Params.Arguments["timeout"].(float64); ok {
			tout := int(t)
			if tout < 1 || tout > 300 {
				return mcp.NewToolResultError("timeout must be between 1 and 300 seconds"), nil
			}
			args = append(args, fmt.Sprintf("-timeout=%d", tout))
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
			if err := validateTags(tags); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid tags: %v", err)), nil
			}
			args = append(args, "-tags", tags)
		}
		if sev, ok := req.Params.Arguments["severity"].(string); ok && sev != "" {
			if err := validateSeverity(sev); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid severity: %v", err)), nil
			}
			args = append(args, "-severity", sev)
		}

		output, err := runCommand(ctx, "nuclei", args...)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("list error: %v", err)), nil
		}

		lines := strings.Split(strings.TrimRight(output, "\n"), "\n")
		const maxLines = 100
		if len(lines) > maxLines {
			// Fix: capture original count before truncating the slice.
			total := len(lines)
			lines = lines[:maxLines]
			lines = append(lines, fmt.Sprintf("... and %d more templates", total-maxLines))
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
