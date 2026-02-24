package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func ListFlows(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
		var flows []map[string]interface{}
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
		if err := d.DB.Exec(
			"INSERT INTO flows (id, project_id, name, objective, status, phase, created_at, updated_at) VALUES (gen_random_uuid(), ?, ?, ?, 'pending', 'recon', NOW(), NOW())",
			projectID, body.Name, body.Objective,
		).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "flow created"})
	}
}

func GetFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var flow map[string]interface{}
		if err := d.DB.Raw("SELECT * FROM flows WHERE id = ?", id).Scan(&flow).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if flow == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "flow not found"})
			return
		}
		c.JSON(http.StatusOK, flow)
	}
}

func DeleteFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		d.DB.Exec("UPDATE flows SET deleted_at = NOW() WHERE id = ?", id)
		c.JSON(http.StatusOK, gin.H{"message": "deleted"})
	}
}

func CancelFlow(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		d.DB.Exec("UPDATE flows SET status = 'cancelled', updated_at = NOW() WHERE id = ?", id)
		c.JSON(http.StatusOK, gin.H{"message": "cancelled"})
	}
}

func ListApprovals(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")
		var approvals []map[string]interface{}
		d.DB.Raw("SELECT * FROM approval_requests WHERE flow_id = ? ORDER BY created_at DESC", flowID).Scan(&approvals)
		c.JSON(http.StatusOK, approvals)
	}
}

func ApprovePhase(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")
		var body struct {
			ApprovalID string `json:"approval_id"`
			Notes      string `json:"notes"`
		}
		_ = c.ShouldBindJSON(&body)
		d.DB.Exec("UPDATE approval_requests SET status = 'approved', reviewed_at = NOW(), notes = ? WHERE id = ? AND flow_id = ?",
			body.Notes, body.ApprovalID, flowID)
		c.JSON(http.StatusOK, gin.H{"message": "approved"})
	}
}

func RejectPhase(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")
		var body struct {
			ApprovalID string `json:"approval_id"`
			Notes      string `json:"notes"`
		}
		_ = c.ShouldBindJSON(&body)
		d.DB.Exec("UPDATE approval_requests SET status = 'rejected', reviewed_at = NOW(), notes = ? WHERE id = ? AND flow_id = ?",
			body.Notes, body.ApprovalID, flowID)
		c.JSON(http.StatusOK, gin.H{"message": "rejected"})
	}
}
