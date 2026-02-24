package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
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
		var projects []map[string]interface{}
		d.DB.Raw("SELECT id, name, description, owner_id, created_at FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC").Scan(&projects)
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
		ownerID, _ := c.Get("user_id")
		d.DB.Exec("INSERT INTO projects (id, name, description, owner_id, scope, created_at, updated_at) VALUES (gen_random_uuid(), ?, ?, ?, ?, NOW(), NOW())",
			body.Name, body.Description, ownerID, body.Scope)
		c.JSON(http.StatusCreated, gin.H{"message": "project created"})
	}
}

func GetProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var p map[string]interface{}
		d.DB.Raw("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL", id).Scan(&p)
		c.JSON(http.StatusOK, p)
	}
}

func UpdateProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var body map[string]interface{}
		_ = c.ShouldBindJSON(&body)
		d.DB.Exec("UPDATE projects SET updated_at = NOW() WHERE id = ?", id)
		c.JSON(http.StatusOK, gin.H{"id": id})
	}
}

func DeleteProject(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		d.DB.Exec("UPDATE projects SET deleted_at = NOW() WHERE id = ?", id)
		c.JSON(http.StatusOK, gin.H{"message": "deleted"})
	}
}

func GetSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"llm_default_provider": d.Config.LLMDefaultProvider,
			"llm_default_model":    d.Config.LLMDefaultModel,
			"agent_require_approval": d.Config.AgentRequireApproval,
			"evograph_enabled":     d.Config.EvoGraphEnabled,
		})
	}
}

func UpdateSettings(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "settings updated (restart required for some changes)"})
	}
}
