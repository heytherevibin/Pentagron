package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// maskKey returns the last 4 characters of a key prefixed with "****",
// or an empty string if the key is empty.
func maskKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 4 {
		return "****"
	}
	return "****" + key[len(key)-4:]
}

// persistSetting writes a single key/value pair to the settings table using upsert.
func persistSetting(d *Deps, key, value string) error {
	return d.DB.Exec(
		"INSERT INTO settings (key, value, updated_at) VALUES (?, ?, NOW()) ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = NOW()",
		key, value, value,
	).Error
}

// ── General Settings ─────────────────────────────────────────────────────────

// GetGeneralSettings returns runtime-mutable general configuration.
func GetGeneralSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"defaultProvider":    d.Config.LLMDefaultProvider,
			"defaultModel":      d.Config.LLMDefaultModel,
			"autoApproval":      !d.Config.AgentRequireApproval,
			"maxIterations":     d.Config.AgentMaxIterations,
			"evographEnabled":   d.Config.EvoGraphEnabled,
			"vectorStoreEnabled": d.Config.VectorStoreEnabled,
		})
	}
}

// UpdateGeneralSettings patches general configuration in-memory and persists to DB.
func UpdateGeneralSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			DefaultProvider    *string `json:"defaultProvider"`
			DefaultModel       *string `json:"defaultModel"`
			AutoApproval       *bool   `json:"autoApproval"`
			MaxIterations      *int    `json:"maxIterations"`
			EvoGraphEnabled    *bool   `json:"evographEnabled"`
			VectorStoreEnabled *bool   `json:"vectorStoreEnabled"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if body.DefaultProvider != nil {
			d.Config.LLMDefaultProvider = *body.DefaultProvider
			_ = persistSetting(d, "LLM_DEFAULT_PROVIDER", *body.DefaultProvider)
		}
		if body.DefaultModel != nil {
			d.Config.LLMDefaultModel = *body.DefaultModel
			_ = persistSetting(d, "LLM_DEFAULT_MODEL", *body.DefaultModel)
		}
		if body.AutoApproval != nil {
			d.Config.AgentRequireApproval = !(*body.AutoApproval)
			_ = persistSetting(d, "AGENT_REQUIRE_APPROVAL", fmt.Sprintf("%t", !(*body.AutoApproval)))
		}
		if body.MaxIterations != nil {
			d.Config.AgentMaxIterations = *body.MaxIterations
			_ = persistSetting(d, "AGENT_MAX_ITERATIONS", fmt.Sprintf("%d", *body.MaxIterations))
		}
		if body.EvoGraphEnabled != nil {
			d.Config.EvoGraphEnabled = *body.EvoGraphEnabled
			_ = persistSetting(d, "EVOGRAPH_ENABLED", fmt.Sprintf("%t", *body.EvoGraphEnabled))
		}
		if body.VectorStoreEnabled != nil {
			d.Config.VectorStoreEnabled = *body.VectorStoreEnabled
			_ = persistSetting(d, "VECTOR_STORE_ENABLED", fmt.Sprintf("%t", *body.VectorStoreEnabled))
		}

		c.JSON(http.StatusOK, gin.H{"message": "general settings updated"})
	}
}

// ── LLM Settings ─────────────────────────────────────────────────────────────

// GetLLMSettings returns provider API key masks, base URLs, and per-agent model overrides.
func GetLLMSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"providers": gin.H{
				"anthropic": gin.H{
					"apiKey":  maskKey(d.Config.AnthropicAPIKey),
					"baseURL": d.Config.AnthropicBaseURL,
				},
				"openai": gin.H{
					"apiKey":  maskKey(d.Config.OpenAIAPIKey),
					"baseURL": d.Config.OpenAIBaseURL,
				},
				"openrouter": gin.H{
					"apiKey":  maskKey(d.Config.OpenRouterAPIKey),
					"baseURL": d.Config.OpenRouterBaseURL,
				},
				"deepseek": gin.H{
					"apiKey":  maskKey(d.Config.DeepSeekAPIKey),
					"baseURL": d.Config.DeepSeekBaseURL,
				},
				"ollama": gin.H{
					"baseURL": d.Config.OllamaBaseURL,
				},
			},
			"agentModels": gin.H{
				"orchestrator": d.Config.AgentModelOrchestrator,
				"pentester":    d.Config.AgentModelPentester,
				"recon":        d.Config.AgentModelRecon,
				"coder":        d.Config.AgentModelCoder,
				"reporter":     d.Config.AgentModelReporter,
				"summarizer":   d.Config.AgentModelSummarizer,
			},
		})
	}
}

// UpdateLLMSettings patches provider keys, base URLs, and agent model overrides.
func UpdateLLMSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Providers   map[string]map[string]string `json:"providers"`
			AgentModels map[string]string            `json:"agentModels"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Provider configs
		if p, ok := body.Providers["anthropic"]; ok {
			if v, exists := p["apiKey"]; exists && v != "" {
				d.Config.AnthropicAPIKey = v
				_ = persistSetting(d, "ANTHROPIC_API_KEY", v)
			}
			if v, exists := p["baseURL"]; exists {
				d.Config.AnthropicBaseURL = v
				_ = persistSetting(d, "ANTHROPIC_BASE_URL", v)
			}
		}
		if p, ok := body.Providers["openai"]; ok {
			if v, exists := p["apiKey"]; exists && v != "" {
				d.Config.OpenAIAPIKey = v
				_ = persistSetting(d, "OPENAI_API_KEY", v)
			}
			if v, exists := p["baseURL"]; exists {
				d.Config.OpenAIBaseURL = v
				_ = persistSetting(d, "OPENAI_BASE_URL", v)
			}
		}
		if p, ok := body.Providers["openrouter"]; ok {
			if v, exists := p["apiKey"]; exists && v != "" {
				d.Config.OpenRouterAPIKey = v
				_ = persistSetting(d, "OPENROUTER_API_KEY", v)
			}
			if v, exists := p["baseURL"]; exists {
				d.Config.OpenRouterBaseURL = v
				_ = persistSetting(d, "OPENROUTER_BASE_URL", v)
			}
		}
		if p, ok := body.Providers["deepseek"]; ok {
			if v, exists := p["apiKey"]; exists && v != "" {
				d.Config.DeepSeekAPIKey = v
				_ = persistSetting(d, "DEEPSEEK_API_KEY", v)
			}
			if v, exists := p["baseURL"]; exists {
				d.Config.DeepSeekBaseURL = v
				_ = persistSetting(d, "DEEPSEEK_BASE_URL", v)
			}
		}
		if p, ok := body.Providers["ollama"]; ok {
			if v, exists := p["baseURL"]; exists {
				d.Config.OllamaBaseURL = v
				_ = persistSetting(d, "OLLAMA_BASE_URL", v)
			}
		}

		// Agent model overrides
		if v, ok := body.AgentModels["orchestrator"]; ok {
			d.Config.AgentModelOrchestrator = v
			_ = persistSetting(d, "AGENT_MODEL_ORCHESTRATOR", v)
		}
		if v, ok := body.AgentModels["pentester"]; ok {
			d.Config.AgentModelPentester = v
			_ = persistSetting(d, "AGENT_MODEL_PENTESTER", v)
		}
		if v, ok := body.AgentModels["recon"]; ok {
			d.Config.AgentModelRecon = v
			_ = persistSetting(d, "AGENT_MODEL_RECON", v)
		}
		if v, ok := body.AgentModels["coder"]; ok {
			d.Config.AgentModelCoder = v
			_ = persistSetting(d, "AGENT_MODEL_CODER", v)
		}
		if v, ok := body.AgentModels["reporter"]; ok {
			d.Config.AgentModelReporter = v
			_ = persistSetting(d, "AGENT_MODEL_REPORTER", v)
		}
		if v, ok := body.AgentModels["summarizer"]; ok {
			d.Config.AgentModelSummarizer = v
			_ = persistSetting(d, "AGENT_MODEL_SUMMARIZER", v)
		}

		c.JSON(http.StatusOK, gin.H{"message": "LLM settings updated"})
	}
}

// TestLLMProvider runs a health check against a single LLM provider.
func TestLLMProvider(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Provider string `json:"provider" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ctx := c.Request.Context()
		start := time.Now()
		statuses := d.LLMMgr.HealthCheck(ctx)
		latency := time.Since(start).Milliseconds()

		err, exists := statuses[body.Provider]
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("provider %q not registered", body.Provider)})
			return
		}

		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"provider":   body.Provider,
				"status":     "error",
				"error":      err.Error(),
				"latency_ms": latency,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"provider":   body.Provider,
			"status":     "ok",
			"latency_ms": latency,
		})
	}
}

// ── MCP Settings ─────────────────────────────────────────────────────────────

// GetMCPSettings returns MCP server URLs from Config.
func GetMCPSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"servers": gin.H{
				"naabu":      d.Config.MCPNaabuURL,
				"sqlmap":     d.Config.MCPSQLMapURL,
				"nuclei":     d.Config.MCPNucleiURL,
				"metasploit": d.Config.MCPMetasploitURL,
			},
		})
	}
}

// UpdateMCPSettings patches MCP server URLs in-memory and persists to DB.
func UpdateMCPSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Servers map[string]string `json:"servers"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if v, ok := body.Servers["naabu"]; ok {
			d.Config.MCPNaabuURL = v
			_ = persistSetting(d, "MCP_NAABU_URL", v)
		}
		if v, ok := body.Servers["sqlmap"]; ok {
			d.Config.MCPSQLMapURL = v
			_ = persistSetting(d, "MCP_SQLMAP_URL", v)
		}
		if v, ok := body.Servers["nuclei"]; ok {
			d.Config.MCPNucleiURL = v
			_ = persistSetting(d, "MCP_NUCLEI_URL", v)
		}
		if v, ok := body.Servers["metasploit"]; ok {
			d.Config.MCPMetasploitURL = v
			_ = persistSetting(d, "MCP_METASPLOIT_URL", v)
		}

		c.JSON(http.StatusOK, gin.H{"message": "MCP settings updated"})
	}
}

// TestMCPServer runs a health check against a single MCP server.
func TestMCPServer(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Server string `json:"server" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ctx := c.Request.Context()
		start := time.Now()
		statuses := d.MCPMgr.HealthCheck(ctx)
		latency := time.Since(start).Milliseconds()

		err, exists := statuses[body.Server]
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("MCP server %q not registered", body.Server)})
			return
		}

		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"server":     body.Server,
				"status":     "error",
				"error":      err.Error(),
				"latency_ms": latency,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"server":     body.Server,
			"status":     "ok",
			"latency_ms": latency,
		})
	}
}

// ── Aggregate Health ─────────────────────────────────────────────────────────

// GetHealthAll returns an aggregate health status for LLM providers, MCP servers,
// database connectivity, and Docker availability.
func GetHealthAll(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// LLM providers
		llmStatuses := d.LLMMgr.HealthCheck(ctx)
		llmResult := make([]gin.H, 0, len(llmStatuses))
		for provider, err := range llmStatuses {
			entry := gin.H{"name": provider, "status": "ok"}
			if err != nil {
				entry["status"] = "error"
				entry["error"] = err.Error()
			}
			llmResult = append(llmResult, entry)
		}

		// MCP servers
		mcpStatuses := d.MCPMgr.HealthCheck(ctx)
		mcpResult := make([]gin.H, 0, len(mcpStatuses))
		for server, err := range mcpStatuses {
			entry := gin.H{"name": server, "status": "ok"}
			if err != nil {
				entry["status"] = "error"
				entry["error"] = err.Error()
			}
			mcpResult = append(mcpResult, entry)
		}

		// Database (with 5s timeout)
		dbStatus := "ok"
		var dbErr string
		dbCtx, dbCancel := context.WithTimeout(ctx, 5*time.Second)
		defer dbCancel()
		if err := d.DB.WithContext(dbCtx).Raw("SELECT 1").Error; err != nil {
			dbStatus = "error"
			dbErr = err.Error()
		}

		// Docker (placeholder — real check would query the Docker socket)
		dockerStatus := "unknown"

		result := gin.H{
			"llm":    llmResult,
			"mcp":    mcpResult,
			"database": gin.H{"status": dbStatus},
			"docker":   gin.H{"status": dockerStatus},
		}
		if dbErr != "" {
			result["database"] = gin.H{"status": dbStatus, "error": dbErr}
		}

		c.JSON(http.StatusOK, result)
	}
}
