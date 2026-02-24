package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is a minimal MCP client that calls an MCP server over HTTP.
// MCP servers expose a POST /call endpoint accepting { name, input } and
// returning { content: [{ text: "..." }] }.
type Client struct {
	baseURL    string
	serverName string
	httpClient *http.Client
}

// NewClient creates an MCP client for the given server URL.
func NewClient(serverName, baseURL string) *Client {
	return &Client{
		serverName: serverName,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 5 * time.Minute},
	}
}

// callRequest is the JSON body sent to an MCP server.
type callRequest struct {
	Method string          `json:"method"`
	Params callParams      `json:"params"`
}

type callParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// callResponse is the JSON body returned by an MCP server.
type callResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	IsError bool `json:"isError"`
}

// Call invokes a tool on the MCP server and returns the text output.
func (c *Client) Call(ctx context.Context, toolName string, input json.RawMessage) (string, error) {
	reqBody := callRequest{
		Method: "tools/call",
		Params: callParams{
			Name:      toolName,
			Arguments: input,
		},
	}

	b, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("mcp %s: marshal request: %w", c.serverName, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/mcp", bytes.NewReader(b))
	if err != nil {
		return "", fmt.Errorf("mcp %s: build request: %w", c.serverName, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("mcp %s: http call: %w", c.serverName, err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("mcp %s: read body: %w", c.serverName, err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("mcp %s: status %d: %s", c.serverName, resp.StatusCode, string(data))
	}

	var result callResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return string(data), nil // return raw if parse fails
	}

	if result.IsError {
		if len(result.Content) > 0 {
			return "", fmt.Errorf("mcp %s tool error: %s", c.serverName, result.Content[0].Text)
		}
		return "", fmt.Errorf("mcp %s: tool returned error", c.serverName)
	}

	var output string
	for _, c := range result.Content {
		if c.Type == "text" {
			output += c.Text
		}
	}
	return output, nil
}

// ListTools queries the MCP server for available tool definitions.
func (c *Client) ListTools(ctx context.Context) ([]ToolInfo, error) {
	reqBody := map[string]string{"method": "tools/list"}
	b, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/mcp", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mcp %s list tools: %w", c.serverName, err)
	}
	defer resp.Body.Close()

	var result struct {
		Tools []ToolInfo `json:"tools"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Tools, nil
}

// ToolInfo describes a tool exposed by an MCP server.
type ToolInfo struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

// HealthCheck pings the MCP server.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("mcp %s health: %w", c.serverName, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("mcp %s health: status %d", c.serverName, resp.StatusCode)
	}
	return nil
}
