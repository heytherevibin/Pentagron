module github.com/pentagron/pentagron

go 1.23

require (
	// HTTP framework
	github.com/gin-gonic/gin v1.10.0
	github.com/gin-contrib/cors v1.7.2

	// LLM SDKs
	github.com/anthropics/anthropic-sdk-go v0.2.0-alpha.13
	github.com/openai/openai-go v0.1.0-alpha.62

	// Neo4j graph database
	github.com/neo4j/neo4j-go-driver/v5 v5.26.0

	// PostgreSQL + ORM
	gorm.io/gorm v1.25.12
	gorm.io/driver/postgres v1.5.11
	github.com/pgvector/pgvector-go v0.2.2

	// WebSocket
	github.com/gorilla/websocket v1.5.3

	// Configuration
	github.com/spf13/viper v1.19.0

	// MCP protocol
	github.com/mark3labs/mcp-go v0.18.0

	// Docker SDK
	github.com/docker/docker v27.4.1+incompatible
	github.com/docker/distribution v2.8.3+incompatible
	github.com/opencontainers/image-spec v1.1.0

	// Redis
	github.com/redis/go-redis/v9 v9.7.0

	// Auth
	github.com/golang-jwt/jwt/v5 v5.2.1
	golang.org/x/crypto v0.31.0

	// UUID
	github.com/google/uuid v1.6.0

	// Database migrations
	github.com/golang-migrate/migrate/v4 v4.18.1

	// Logging
	go.uber.org/zap v1.27.0

	// Utilities
	github.com/samber/lo v1.47.0
	golang.org/x/sync v0.10.0
)
