package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// userResponse is the JSON shape returned for user records (password excluded).
type userResponse struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ProjectCount int       `json:"project_count"`
}

// ListUsers returns all non-deleted users with their project counts.
func ListUsers(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		type userRow struct {
			ID        string    `json:"id"`
			Email     string    `json:"email"`
			Role      string    `json:"role"`
			CreatedAt time.Time `json:"created_at"`
			UpdatedAt time.Time `json:"updated_at"`
		}

		rows := make([]userRow, 0)
		if err := d.DB.Raw("SELECT id, email, role, created_at, updated_at FROM users WHERE deleted_at IS NULL ORDER BY created_at").Scan(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		users := make([]userResponse, 0, len(rows))
		for _, r := range rows {
			var count int
			// user_projects table is optional; silently default to 0 if query fails
			if err := d.DB.Raw("SELECT COUNT(*) FROM user_projects WHERE user_id = ?", r.ID).Scan(&count).Error; err != nil {
				count = 0
			}

			users = append(users, userResponse{
				ID:           r.ID,
				Email:        r.Email,
				Role:         r.Role,
				CreatedAt:    r.CreatedAt,
				UpdatedAt:    r.UpdatedAt,
				ProjectCount: count,
			})
		}

		c.JSON(http.StatusOK, users)
	}
}

// CreateUser registers a new user with a bcrypt-hashed password.
func CreateUser(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email    string `json:"email" binding:"required"`
			Password string `json:"password" binding:"required"`
			Role     string `json:"role"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if body.Role == "" {
			body.Role = "operator"
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		var newID string
		if err := d.DB.Raw(
			"INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (gen_random_uuid(), ?, ?, ?, NOW(), NOW()) RETURNING id",
			body.Email, string(hashed), body.Role,
		).Scan(&newID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"id":    newID,
			"email": body.Email,
			"role":  body.Role,
		})
	}
}

// UpdateUser changes a user's role.
func UpdateUser(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("user_id")

		var body struct {
			Role string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result := d.DB.Exec("UPDATE users SET role = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL", body.Role, id)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "user updated"})
	}
}

// DeactivateUser soft-deletes a user by setting deleted_at.
func DeactivateUser(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("user_id")

		result := d.DB.Exec("UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "user deactivated"})
	}
}

// ResetPassword sets a new bcrypt-hashed password for the given user.
func ResetPassword(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("user_id")

		var body struct {
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		result := d.DB.Exec("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL", string(hashed), id)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "password reset successfully"})
	}
}
