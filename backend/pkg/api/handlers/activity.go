package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type activityFlowSummary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	Phase       string    `json:"phase"`
	UpdatedAt   time.Time `json:"updated_at"`
	ProjectID   string    `json:"project_id,omitempty"`
	ProjectName string    `json:"project_name,omitempty"`
}

// activityEvent matches the frontend audit stream shape.
type activityEvent struct {
	ID        string               `json:"id"`
	Type      string               `json:"type"`
	Message   string               `json:"message"`
	CreatedAt time.Time            `json:"created_at"`
	Actor     string               `json:"actor,omitempty"`
	Status    string               `json:"status,omitempty"`
	Flow      *activityFlowSummary `json:"flow,omitempty"`
}

// GetActivity returns the 20 most recent flow events for the activity feed.
func GetActivity(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		type row struct {
			FlowID      string    `json:"flow_id"`
			FlowName    string    `json:"flow_name"`
			Status      string    `json:"status"`
			Phase       string    `json:"phase"`
			UpdatedAt   time.Time `json:"updated_at"`
			ProjectID   string    `json:"project_id"`
			ProjectName string    `json:"project_name"`
		}

		rows := make([]row, 0)
		if err := d.DB.Raw(
			"SELECT f.id AS flow_id, f.name AS flow_name, f.status, f.phase, f.updated_at, "+
				"p.id AS project_id, p.name AS project_name "+
				"FROM flows f JOIN projects p ON f.project_id = p.id "+
				"WHERE f.deleted_at IS NULL AND p.deleted_at IS NULL "+
				"ORDER BY f.updated_at DESC LIMIT 20",
		).Scan(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		events := make([]activityEvent, 0, len(rows))
		for _, r := range rows {
			eventType := "flow_update"
			message := r.FlowName + " is " + r.Status + " (phase: " + r.Phase + ")"

			switch r.Status {
			case "running":
				eventType = "flow_started"
				message = r.FlowName + " started " + r.Phase + " phase"
			case "completed":
				eventType = "flow_completed"
				message = r.FlowName + " completed successfully"
			case "failed":
				eventType = "flow_failed"
				message = r.FlowName + " failed during " + r.Phase + " phase"
			case "cancelled":
				eventType = "flow_cancelled"
				message = r.FlowName + " was cancelled"
			case "pending":
				eventType = "flow_created"
				message = r.FlowName + " created for project " + r.ProjectName
			case "awaiting_approval":
				eventType = "approval_required"
				message = r.FlowName + " awaiting approval for " + r.Phase + " phase"
			}

			events = append(events, activityEvent{
				ID:        fmt.Sprintf("%s:%s:%s", r.FlowID, eventType, r.UpdatedAt.UTC().Format(time.RFC3339Nano)),
				Type:      eventType,
				Message:   message,
				Status:    r.Status,
				CreatedAt: r.UpdatedAt,
				Actor:     "system",
				Flow: &activityFlowSummary{
					ID:          r.FlowID,
					Name:        r.FlowName,
					Status:      r.Status,
					Phase:       r.Phase,
					UpdatedAt:   r.UpdatedAt,
					ProjectID:   r.ProjectID,
					ProjectName: r.ProjectName,
				},
			})
		}

		c.JSON(http.StatusOK, events)
	}
}
