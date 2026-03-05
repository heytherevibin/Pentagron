package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Client is an MCP client that communicates with MCP servers over the SSE
// transport defined by the Model Context Protocol. It establishes a persistent
// SSE connection (GET /sse) to obtain a session, then sends JSON-RPC 2.0
// requests via POST /message?sessionId=<id>.
type Client struct {
	baseURL    string
	serverName string
	httpClient *http.Client // for JSON-RPC POSTs (has timeout)
	reqID      atomic.Int64

	mu         sync.Mutex
	messageURL string             // full POST URL with sessionId
	sseCancel  context.CancelFunc // cancels the SSE background reader
}

// NewClient creates an MCP client for the given server URL.
func NewClient(serverName, baseURL string) *Client {
	return &Client{
		serverName: serverName,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 5 * time.Minute},
	}
}

// jsonRPCRequest is a JSON-RPC 2.0 request.
type jsonRPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int64       `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// jsonRPCResponse is a JSON-RPC 2.0 response.
type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ensureConnected establishes an SSE session if one doesn't exist.
func (c *Client) ensureConnected(ctx context.Context) error {
	c.mu.Lock()
	if c.messageURL != "" {
		c.mu.Unlock()
		return nil
	}
	defer c.mu.Unlock()
	return c.connectLocked(ctx)
}

// connectLocked establishes the SSE connection and extracts the message endpoint.
// Must be called with c.mu held.
func (c *Client) connectLocked(ctx context.Context) error {
	sseCtx, cancel := context.WithCancel(context.Background())

	req, err := http.NewRequestWithContext(sseCtx, http.MethodGet, c.baseURL+"/sse", nil)
	if err != nil {
		cancel()
		return fmt.Errorf("mcp %s: build SSE request: %w", c.serverName, err)
	}
	req.Header.Set("Accept", "text/event-stream")

	// No overall timeout (the SSE stream is long-lived), but add a 10s dial
	// timeout so we fail fast when the MCP server is unreachable.
	sseHTTP := &http.Client{
		Transport: &http.Transport{
			DialContext: (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
		},
	}
	resp, err := sseHTTP.Do(req)
	if err != nil {
		cancel()
		return fmt.Errorf("mcp %s: SSE connect: %w", c.serverName, err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		cancel()
		return fmt.Errorf("mcp %s: SSE status %d", c.serverName, resp.StatusCode)
	}

	// Read the initial "endpoint" event from the SSE stream.
	// Format: "event: endpoint\ndata: /message?sessionId=<uuid>\n\n"
	scanner := bufio.NewScanner(resp.Body)
	var endpoint string
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			endpoint = strings.TrimPrefix(line, "data: ")
			break
		}
	}
	if err := scanner.Err(); err != nil {
		resp.Body.Close()
		cancel()
		return fmt.Errorf("mcp %s: read SSE endpoint: %w", c.serverName, err)
	}
	if endpoint == "" {
		resp.Body.Close()
		cancel()
		return fmt.Errorf("mcp %s: no endpoint received from SSE", c.serverName)
	}

	// Build the full message URL. The SSE server may return a relative path
	// ("/message?sessionId=xxx") or a full URL. We always combine with our
	// baseURL to ensure we reach the right host.
	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		if u, parseErr := url.Parse(endpoint); parseErr == nil {
			c.messageURL = c.baseURL + u.RequestURI()
		} else {
			c.messageURL = endpoint
		}
	} else {
		c.messageURL = c.baseURL + endpoint
	}

	c.sseCancel = cancel

	// Background goroutine keeps the SSE connection alive by consuming events.
	// When the connection drops, it marks the client as disconnected so the
	// next RPC call triggers a reconnect.
	go func() {
		defer resp.Body.Close()
		for scanner.Scan() {
			select {
			case <-sseCtx.Done():
				return
			default:
			}
		}
		// Connection lost — clear session so next call reconnects.
		c.mu.Lock()
		c.messageURL = ""
		c.sseCancel = nil
		c.mu.Unlock()
	}()

	return nil
}

// Close tears down the SSE connection.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sseCancel != nil {
		c.sseCancel()
		c.sseCancel = nil
	}
	c.messageURL = ""
}

// doRPC sends a JSON-RPC 2.0 request over the SSE session and returns the result.
func (c *Client) doRPC(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	if err := c.ensureConnected(ctx); err != nil {
		return nil, err
	}

	c.mu.Lock()
	msgURL := c.messageURL
	c.mu.Unlock()

	if msgURL == "" {
		return nil, fmt.Errorf("mcp %s: not connected", c.serverName)
	}

	reqBody := jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      c.reqID.Add(1),
		Method:  method,
		Params:  params,
	}

	b, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("mcp %s: marshal request: %w", c.serverName, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, msgURL, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("mcp %s: build request: %w", c.serverName, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Connection may have dropped — clear session for reconnect.
		c.mu.Lock()
		c.messageURL = ""
		c.mu.Unlock()
		return nil, fmt.Errorf("mcp %s: http call: %w", c.serverName, err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("mcp %s: read body: %w", c.serverName, err)
	}

	// SSE transport returns 202 Accepted; also accept 200 OK for compatibility.
	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mcp %s: status %d: %s", c.serverName, resp.StatusCode, string(data))
	}

	if len(data) == 0 {
		return nil, nil
	}

	var rpcResp jsonRPCResponse
	if err := json.Unmarshal(data, &rpcResp); err != nil {
		return nil, fmt.Errorf("mcp %s: decode response: %w", c.serverName, err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("mcp %s: rpc error %d: %s", c.serverName, rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

// Call invokes a tool on the MCP server and returns the text output.
func (c *Client) Call(ctx context.Context, toolName string, input json.RawMessage) (string, error) {
	params := map[string]interface{}{
		"name":      toolName,
		"arguments": json.RawMessage(input),
	}

	result, err := c.doRPC(ctx, "tools/call", params)
	if err != nil {
		return "", err
	}

	var callResult struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError"`
	}
	if err := json.Unmarshal(result, &callResult); err != nil {
		// Return raw result if structured parse fails.
		return string(result), nil
	}

	if callResult.IsError {
		if len(callResult.Content) > 0 {
			return "", fmt.Errorf("mcp %s tool error: %s", c.serverName, callResult.Content[0].Text)
		}
		return "", fmt.Errorf("mcp %s: tool returned error", c.serverName)
	}

	var output string
	for _, item := range callResult.Content {
		if item.Type == "text" {
			output += item.Text
		}
	}
	return output, nil
}

// ListTools queries the MCP server for available tool definitions.
func (c *Client) ListTools(ctx context.Context) ([]ToolInfo, error) {
	result, err := c.doRPC(ctx, "tools/list", nil)
	if err != nil {
		return nil, fmt.Errorf("mcp %s list tools: %w", c.serverName, err)
	}

	var toolsResult struct {
		Tools []ToolInfo `json:"tools"`
	}
	if err := json.Unmarshal(result, &toolsResult); err != nil {
		return nil, fmt.Errorf("mcp %s list tools: decode result: %w", c.serverName, err)
	}
	return toolsResult.Tools, nil
}

// ToolInfo describes a tool exposed by an MCP server.
type ToolInfo struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

// HealthCheck verifies the MCP server is reachable by ensuring the SSE session
// can be established.
func (c *Client) HealthCheck(ctx context.Context) error {
	return c.ensureConnected(ctx)
}
