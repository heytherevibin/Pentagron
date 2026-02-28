package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// MessageType identifies the kind of WebSocket message.
type MessageType string

const (
	TypeAgentThought MessageType = "agent_thought"
	TypeToolCall     MessageType = "tool_call"
	TypeToolResult   MessageType = "tool_result"
	TypePhaseChange  MessageType = "phase_change"
	TypeApproval     MessageType = "approval_request"
	TypeUserGuidance MessageType = "user_guidance"
	TypeFinalAnswer  MessageType = "final_answer"
	TypeError        MessageType = "error"
	TypePing         MessageType = "ping"
)

// Message is the WebSocket envelope sent to clients.
type Message struct {
	Type      MessageType `json:"type"`
	SessionID string      `json:"session_id"`
	FlowID    string      `json:"flow_id"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}

// Client represents a single WebSocket connection.
type Client struct {
	conn      *websocket.Conn
	sessionID string
	flowID    string
	send      chan []byte
	hub       *Hub
	log       *zap.Logger
	closeOnce sync.Once
}

// Hub manages all active WebSocket connections and broadcasts messages.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[*Client]bool // flowID → clients
	log     *zap.Logger
}

// NewHub creates a new WebSocket hub.
func NewHub(log *zap.Logger) *Hub {
	return &Hub{
		clients: make(map[string]map[*Client]bool),
		log:     log,
	}
}

// Register adds a client to the hub for the given flow.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.flowID] == nil {
		h.clients[c.flowID] = make(map[*Client]bool)
	}
	h.clients[c.flowID][c] = true
	h.log.Info("websocket client connected",
		zap.String("session", c.sessionID),
		zap.String("flow", c.flowID),
	)
}

// Unregister removes a client from the hub. Safe to call multiple times.
// Does not close the client's send channel; the client must do that exactly once.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.clients[c.flowID]; ok {
		delete(clients, c)
		if len(clients) == 0 {
			delete(h.clients, c.flowID)
		}
	}
}

// Broadcast sends a message to all clients subscribed to a flow.
func (h *Hub) Broadcast(flowID string, msg Message) {
	msg.Timestamp = time.Now()
	b, err := json.Marshal(msg)
	if err != nil {
		h.log.Error("failed to marshal ws message", zap.Error(err))
		return
	}

	h.mu.RLock()
	clients := h.clients[flowID]
	h.mu.RUnlock()

	for c := range clients {
		select {
		case c.send <- b:
		default:
			h.log.Warn("ws client send buffer full, dropping message",
				zap.String("session", c.sessionID))
		}
	}
}

// NewClient creates a new WebSocket client.
func NewClient(conn *websocket.Conn, sessionID, flowID string, hub *Hub, log *zap.Logger) *Client {
	return &Client{
		conn:      conn,
		sessionID: sessionID,
		flowID:    flowID,
		send:      make(chan []byte, 256),
		hub:       hub,
		log:       log,
	}
}

// close ensures send channel is closed once, unregisters from hub, and closes the conn.
// Safe to call from both ReadPump and WritePump; only the first call does the work.
func (c *Client) close() {
	c.closeOnce.Do(func() {
		close(c.send)
		c.hub.Unregister(c)
		_ = c.conn.Close()
	})
}

// WritePump pumps messages from the send channel to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump reads incoming messages (guidance injection, approvals) from the client.
func (c *Client) ReadPump() {
	defer c.close()

	c.conn.SetReadLimit(64 * 1024)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			c.log.Warn("invalid ws message", zap.Error(err))
			continue
		}

		// Broadcast guidance back to the flow so agents can receive it
		if msg.Type == TypeUserGuidance {
			c.hub.Broadcast(c.flowID, msg)
		}
	}
}
