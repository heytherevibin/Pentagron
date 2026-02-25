package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// activityEvent represents a single activity feed entry.
type activityEvent struct {
	FlowName    string    `json:"flow_name"`
	ProjectName string    `json:"project_name"`
	Status      string    `json:"status"`
	Phase       string    `json:"phase"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
}

// GetActivity returns the 20 most recent flow events for the activity feed.
func GetActivity(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		type row struct {
			FlowName    string    `json:"flow_name"`
			Status      string    `json:"status"`
			Phase       string    `json:"phase"`
			UpdatedAt   time.Time `json:"updated_at"`
			ProjectName string    `json:"project_name"`
		}

		rows := make([]row, 0)
		if err := d.DB.Raw(
			"SELECT f.name AS flow_name, f.status, f.phase, f.updated_at, p.name AS project_name "+
				"FROM flows f JOIN projects p ON f.project_id = p.id "+
				"WHERE f.deleted_at IS NULL "+
				"ORDER BY f.updated_at DESC LIMIT 20",
		).Scan(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		events := make([]activityEvent, 0, len(rows))
		for _, r := range rows {
			eventType := "flow_update"
			description := r.FlowName + " is " + r.Status + " (phase: " + r.Phase + ")"

			switch r.Status {
			case "running":
				eventType = "flow_started"
				description = r.FlowName + " started " + r.Phase + " phase"
			case "completed":
				eventType = "flow_completed"
				description = r.FlowName + " completed successfully"
			case "failed":
				eventType = "flow_failed"
				description = r.FlowName + " failed during " + r.Phase + " phase"
			case "cancelled":
				eventType = "flow_cancelled"
				description = r.FlowName + " was cancelled"
			case "pending":
				eventType = "flow_created"
				description = r.FlowName + " created for project " + r.ProjectName
			case "awaiting_approval":
				eventType = "approval_required"
				description = r.FlowName + " awaiting approval for " + r.Phase + " phase"
			}

			events = append(events, activityEvent{
				FlowName:    r.FlowName,
				ProjectName: r.ProjectName,
				Status:      r.Status,
				Phase:       r.Phase,
				Type:        eventType,
				Description: description,
				Timestamp:   r.UpdatedAt,
			})
		}

		c.JSON(http.StatusOK, events)
	}
}
