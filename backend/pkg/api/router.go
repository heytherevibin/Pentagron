package api

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/api/handlers"
	"github.com/pentagron/pentagron/pkg/api/middleware"
	"github.com/pentagron/pentagron/pkg/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:    func(r *http.Request) bool { return true }, // refined in middleware
}

// Setup creates and returns the configured Gin router.
func Setup(deps *handlers.Deps, hub *ws.Hub, corsOrigin string, log *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.Logger(log))

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{corsOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// ── Health ────────────────────────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ── Auth ─────────────────────────────────────────────────────────────────
	auth := r.Group("/api/auth")
	{
		auth.POST("/login", handlers.Login(deps))
		auth.POST("/logout", handlers.Logout(deps))
	}

	// ── API (protected) ───────────────────────────────────────────────────────
	api := r.Group("/api", middleware.Auth(deps.Config.JWTSecret))
	{
		// Projects
		api.GET("/projects", handlers.ListProjects(deps))
		api.POST("/projects", handlers.CreateProject(deps))
		api.GET("/projects/:id", handlers.GetProject(deps))
		api.PUT("/projects/:id", handlers.UpdateProject(deps))
		api.DELETE("/projects/:id", handlers.DeleteProject(deps))

		// Flows
		api.GET("/projects/:id/flows", handlers.ListFlows(deps))
		api.POST("/projects/:id/flows", handlers.CreateFlow(deps))
		api.GET("/flows/:id", handlers.GetFlow(deps))
		api.DELETE("/flows/:id", handlers.DeleteFlow(deps))
		api.POST("/flows/:id/start", handlers.StartFlow(deps))
		api.POST("/flows/:id/cancel", handlers.CancelFlow(deps))

		// Approvals
		api.GET("/flows/:id/approvals", handlers.ListApprovals(deps))
		api.POST("/flows/:id/approve", handlers.ApprovePhase(deps))
		api.POST("/flows/:id/reject", handlers.RejectPhase(deps))

		// EvoGraph
		api.GET("/flows/:id/graph", handlers.GetFlowGraph(deps))

		// Reports
		api.GET("/flows/:id/report", handlers.ExportFlowReport(deps))

		// Models
		api.GET("/models", handlers.ListModels(deps))

		// Settings — General
		api.GET("/settings/general", handlers.GetGeneralSettings(deps))
		api.PUT("/settings/general", handlers.UpdateGeneralSettings(deps))

		// Settings — LLM
		api.GET("/settings/llm", handlers.GetLLMSettings(deps))
		api.PUT("/settings/llm", handlers.UpdateLLMSettings(deps))
		api.POST("/settings/llm/test", handlers.TestLLMProvider(deps))

		// Settings — MCP
		api.GET("/settings/mcp", handlers.GetMCPSettings(deps))
		api.PUT("/settings/mcp", handlers.UpdateMCPSettings(deps))
		api.POST("/settings/mcp/test", handlers.TestMCPServer(deps))

		// Users (admin only)
		admin := api.Group("", middleware.RequireAdmin())
		admin.GET("/users", handlers.ListUsers(deps))
		admin.POST("/users", handlers.CreateUser(deps))
		admin.PUT("/users/:user_id", handlers.UpdateUser(deps))
		admin.DELETE("/users/:user_id", handlers.DeactivateUser(deps))
		admin.POST("/users/:user_id/reset-password", handlers.ResetPassword(deps))

		// Activity
		api.GET("/activity", handlers.GetActivity(deps))

		// Health checks
		api.GET("/health/providers", handlers.ProviderHealth(deps))
		api.GET("/health/mcp", handlers.MCPHealth(deps))
		api.GET("/health/all", handlers.GetHealthAll(deps))
	}

	// ── WebSocket ─────────────────────────────────────────────────────────────
	r.GET("/ws/agent/:session_id", middleware.Auth(deps.Config.JWTSecret), func(c *gin.Context) {
		sessionID := c.Param("session_id")
		flowID := c.Query("flow_id")

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Error("ws upgrade failed", zap.Error(err))
			return
		}

		client := ws.NewClient(conn, sessionID, flowID, hub, log)
		hub.Register(client)
		go client.WritePump()
		client.ReadPump()
	})

	r.GET("/ws/logs/:flow_id", middleware.Auth(deps.Config.JWTSecret), func(c *gin.Context) {
		flowID := c.Param("flow_id")
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		client := ws.NewClient(conn, "log-"+flowID, flowID, hub, log)
		hub.Register(client)
		go client.WritePump()
		client.ReadPump()
	})

	return r
}
