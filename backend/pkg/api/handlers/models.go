package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func ListModels(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		models, err := d.LLMMgr.AllModels(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"models": models})
	}
}

func ProviderHealth(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		statuses := d.LLMMgr.HealthCheck(c.Request.Context())
		result := make(map[string]string)
		for provider, err := range statuses {
			if err != nil {
				result[provider] = "error: " + err.Error()
			} else {
				result[provider] = "ok"
			}
		}
		c.JSON(http.StatusOK, result)
	}
}

func MCPHealth(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		statuses := d.MCPMgr.HealthCheck(c.Request.Context())
		result := make(map[string]string)
		for server, err := range statuses {
			if err != nil {
				result[server] = "error: " + err.Error()
			} else {
				result[server] = "ok"
			}
		}
		c.JSON(http.StatusOK, result)
	}
}
