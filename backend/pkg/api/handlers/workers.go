package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/pentagron/pentagron/pkg/database"
)

// RegisterWorker handles POST /api/workers/register.
// A worker node calls this on startup (and periodically) to announce itself.
//
//	Body: { "id": "worker-host-123", "hostname": "kali-node-1", "capabilities": ["naabu","nuclei"] }
func RegisterWorker(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			ID           string   `json:"id" binding:"required"`
			Hostname     string   `json:"hostname" binding:"required"`
			Capabilities []string `json:"capabilities"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		capsJSON := "[]"
		if len(body.Capabilities) > 0 {
			if b, err := json.Marshal(body.Capabilities); err == nil {
				capsJSON = string(b)
			}
		}

		now := time.Now().UTC()
		worker := database.WorkerNode{
			ID:           body.ID,
			Hostname:     body.Hostname,
			Capabilities: capsJSON,
			Status:       database.WorkerStatusOnline,
			LastSeenAt:   now,
			RegisteredAt: now,
			UpdatedAt:    now,
		}

		// Upsert: update last_seen_at + capabilities on re-register
		if err := d.DB.Save(&worker).Error; err != nil {
			d.Log.Error("worker register failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "registration failed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"worker_id": body.ID,
			"status":    "registered",
		})
	}
}

// PollWorkerTasks handles GET /api/workers/:worker_id/tasks.
// Returns the next pending task for the worker (if any). Workers poll this endpoint.
func PollWorkerTasks(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")
		if workerID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "worker_id required"})
			return
		}

		// Heartbeat: update last_seen_at
		d.DB.Model(&database.WorkerNode{}).
			Where("id = ?", workerID).
			Updates(map[string]any{
				"last_seen_at": time.Now().UTC(),
				"status":       string(database.WorkerStatusOnline),
				"updated_at":   time.Now().UTC(),
			})

		// Find oldest pending task assigned to this worker
		var task database.WorkerTask
		err := d.DB.
			Where("worker_id = ? AND status = ?", workerID, database.WorkerTaskPending).
			Order("created_at ASC").
			First(&task).Error

		if err != nil {
			// No pending tasks — return empty
			c.JSON(http.StatusOK, gin.H{"task": nil})
			return
		}

		// Mark as dispatched so it won't be handed to another worker
		d.DB.Model(&task).Updates(map[string]any{
			"status":     string(database.WorkerTaskDispatched),
			"updated_at": time.Now().UTC(),
		})

		c.JSON(http.StatusOK, gin.H{"task": task})
	}
}

// SubmitWorkerResult handles POST /api/workers/:worker_id/results.
// Workers post the outcome of a completed tool execution here.
//
//	Body: { "task_id": "uuid", "output": "...", "error": "", "success": true }
func SubmitWorkerResult(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")
		if workerID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "worker_id required"})
			return
		}

		var body struct {
			TaskID  string `json:"task_id" binding:"required"`
			Output  string `json:"output"`
			Error   string `json:"error"`
			Success bool   `json:"success"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		status := database.WorkerTaskCompleted
		if !body.Success {
			status = database.WorkerTaskFailed
		}

		result := d.DB.Model(&database.WorkerTask{}).
			Where("id = ? AND worker_id = ?", body.TaskID, workerID).
			Updates(map[string]any{
				"output":     body.Output,
				"error":      body.Error,
				"status":     string(status),
				"updated_at": time.Now().UTC(),
			})
		if result.Error != nil || result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found or not owned by this worker"})
			return
		}

		// Update worker status back to online (was busy while executing)
		d.DB.Model(&database.WorkerNode{}).
			Where("id = ?", workerID).
			Updates(map[string]any{
				"status":       string(database.WorkerStatusOnline),
				"last_seen_at": time.Now().UTC(),
				"updated_at":   time.Now().UTC(),
			})

		c.JSON(http.StatusOK, gin.H{"status": "accepted"})
	}
}
