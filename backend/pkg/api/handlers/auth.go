package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/pentagron/pentagron/pkg/database"
)

func Login(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email    string `json:"email" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var user struct {
			ID       string
			Email    string
			Password string
			Role     string
		}
		if err := d.DB.Raw("SELECT id, email, password, role FROM users WHERE email = ? AND deleted_at IS NULL", body.Email).Scan(&user).Error; err != nil || user.ID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(body.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub":   user.ID,
			"email": user.Email,
			"role":  user.Role,
			"exp":   time.Now().Add(24 * time.Hour).Unix(),
		})
		tokenStr, err := token.SignedString([]byte(d.Config.JWTSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token": tokenStr,
			"user":  gin.H{"id": user.ID, "email": user.Email, "role": user.Role},
		})
	}
}

func Logout(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		// JWT is stateless; client drops the token
		c.JSON(http.StatusOK, gin.H{"message": "logged out"})
	}
}

func ListProjects(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		role, _ := c.Get("user_role")

		projects := make([]map[string]interface{}, 0)
		var err error
		if role == "admin" {
			err = d.DB.Raw("SELECT id, name, description, owner_id, created_at FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC").Scan(&projects).Error
		} else {
			err = d.DB.Raw("SELECT id, name, description, owner_id, created_at FROM projects WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC", userID).Scan(&projects).Error
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, projects)
	}
}

func CreateProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Name        string `json:"name" binding:"required"`
			Description string `json:"description"`
			Scope       string `json:"scope"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		ownerIDVal, ok := c.Get("user_id")
		if !ok || ownerIDVal == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		var ownerID uuid.UUID
		switch v := ownerIDVal.(type) {
		case string:
			var err error
			ownerID, err = uuid.Parse(v)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
				return
			}
		case float64:
			// JWT numeric claims can unmarshal as float64
			ownerID = uuid.Nil
			// Re-fetch from DB by email if we only have a numeric sub (legacy)
			emailVal, _ := c.Get("user_email")
			if emailStr, ok := emailVal.(string); ok && emailStr != "" {
				var u struct{ ID uuid.UUID }
				if d.DB.Raw("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", emailStr).Scan(&u).Error == nil {
					ownerID = u.ID
				}
			}
			if ownerID == uuid.Nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
				return
			}
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}
		// Ensure user still exists (e.g. after DB reset) to avoid FK violation
		var exists int64
		if d.DB.Model(&database.User{}).Where("id = ? AND deleted_at IS NULL", ownerID).Count(&exists).Error != nil || exists == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "session invalid, please log in again"})
			return
		}
		proj := database.Project{
			Name:        body.Name,
			Description: body.Description,
			Scope:       body.Scope,
			OwnerID:     ownerID,
		}
		if err := d.DB.Create(&proj).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": proj.ID.String(), "message": "project created"})
	}
}

func GetProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var p map[string]interface{}
		if err := d.DB.Raw("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL", id).Scan(&p).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if len(p) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
			return
		}
		if !isProjectOwnerOrAdmin(c, p) {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}

func UpdateProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Check ownership
		var p map[string]interface{}
		if err := d.DB.Raw("SELECT id, owner_id FROM projects WHERE id = ? AND deleted_at IS NULL", id).Scan(&p).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if len(p) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
			return
		}
		if !isProjectOwnerOrAdmin(c, p) {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}

		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		d.DB.Exec("UPDATE projects SET updated_at = NOW() WHERE id = ?", id)
		c.JSON(http.StatusOK, gin.H{"id": id})
	}
}

func DeleteProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Check ownership
		var p map[string]interface{}
		if err := d.DB.Raw("SELECT id, owner_id FROM projects WHERE id = ? AND deleted_at IS NULL", id).Scan(&p).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if len(p) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
			return
		}
		if !isProjectOwnerOrAdmin(c, p) {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}

		d.DB.Exec("UPDATE projects SET deleted_at = NOW() WHERE id = ?", id)
		c.JSON(http.StatusOK, gin.H{"message": "deleted"})
	}
}

// isProjectOwnerOrAdmin returns true if the requesting user owns the project or is an admin.
func isProjectOwnerOrAdmin(c *gin.Context, project map[string]interface{}) bool {
	role, _ := c.Get("user_role")
	if role == "admin" {
		return true
	}
	userID, _ := c.Get("user_id")
	ownerID, _ := project["owner_id"]
	return userID == ownerID
}

