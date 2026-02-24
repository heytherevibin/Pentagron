package handlers

import (
	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Deps holds all dependencies injected into HTTP handlers.
type Deps struct {
	Config  *config.Config
	DB      *gorm.DB
	LLMMgr  *llm.Manager
	MCPMgr  *mcp.Manager
	Log     *zap.Logger
}
