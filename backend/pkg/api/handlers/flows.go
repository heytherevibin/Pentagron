package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// checkFlowAccess verifies the user owns the parent project (or is an admin).
// Returns the flow map on success, or aborts the request and returns nil.
func checkFlowAccess(c *gin.Context, d *Deps, flowID string) map[string]interface{} {
	var flow map[string]interface{}
	if err := d.DB.Raw("SELECT f.*, p.owner_id AS project_owner_id FROM flows f JOIN projects p ON p.id = f.project_id WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL", flowID).Scan(&flow).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil
	}
	if len(flow) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "flow not found"})
		return nil
	}
	role, _ := c.Get("user_role")
	if role != "admin" {
		userID, _ := c.Get("user_id")
		ownerID := flow["project_owner_id"]
		if userID != ownerID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return nil
		}
	}
	return flow
}

func ListFlows(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
		flows := make([]map[string]interface{}, 0)
		if err := d.DB.Raw("SELECT * FROM flows WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC", projectID).Scan(&flows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, flows)
	}
}

func CreateFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
		var body struct {
			Name      string `json:"name" binding:"required"`
			Objective string `json:"objective" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		newID := uuid.New().String()
		if err := d.DB.Exec(
			"INSERT INTO flows (id, project_id, name, objective, status, phase, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 'recon', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
			newID, projectID, body.Name, body.Objective,
		).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": newID, "message": "flow created"})
	}
}

func GetFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		flow := checkFlowAccess(c, d, id)
		if flow == nil {
			return
		}
		delete(flow, "project_owner_id")
		c.JSON(http.StatusOK, flow)
	}
}

func DeleteFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if flow := checkFlowAccess(c, d, id); flow == nil {
			return
		}
		result := d.DB.Exec("UPDATE flows SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", id)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "deleted"})
	}
}

// StartFlow launches the flow engine for the given flow in a background goroutine.
// The flow must be in pending or paused status.
func StartFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		flow := checkFlowAccess(c, d, id)
		if flow == nil {
			return
		}

		status, _ := flow["status"].(string)
		if status != "pending" && status != "paused" {
			c.JSON(http.StatusConflict, gin.H{"error": "flow is not in a startable state", "status": status})
			return
		}

		d.FlowEngine.Start(id)
		c.JSON(http.StatusAccepted, gin.H{"message": "flow started", "flow_id": id})
	}
}

// CancelFlow cancels a running flow — updates DB status and signals the engine goroutine.
func CancelFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if flow := checkFlowAccess(c, d, id); flow == nil {
			return
		}
		d.FlowEngine.Cancel(id)
		if result := d.DB.Exec("UPDATE flows SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", id); result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "cancelled"})
	}
}

func ListApprovals(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")
		if flow := checkFlowAccess(c, d, flowID); flow == nil {
			return
		}
		approvals := make([]map[string]interface{}, 0)
		if err := d.DB.Raw("SELECT * FROM approval_requests WHERE flow_id = ? ORDER BY created_at DESC", flowID).Scan(&approvals).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, approvals)
	}
}

func ApprovePhase(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")
		if flow := checkFlowAccess(c, d, flowID); flow == nil {
			return
		}
		var body struct {
			ApprovalID string `json:"approval_id"`
			Notes      string `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if result := d.DB.Exec("UPDATE approval_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ? AND flow_id = ?",
			body.Notes, body.ApprovalID, flowID); result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		d.FlowEngine.NotifyApproval(flowID)
		c.JSON(http.StatusOK, gin.H{"message": "approved"})
	}
}

func RejectPhase(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")
		if flow := checkFlowAccess(c, d, flowID); flow == nil {
			return
		}
		var body struct {
			ApprovalID string `json:"approval_id"`
			Notes      string `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		d.DB.Exec("UPDATE approval_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ? AND flow_id = ?",
			body.Notes, body.ApprovalID, flowID)
		d.FlowEngine.NotifyApproval(flowID)
		c.JSON(http.StatusOK, gin.H{"message": "rejected"})
	}
}
