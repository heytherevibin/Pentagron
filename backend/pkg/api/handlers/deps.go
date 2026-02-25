package handlers

import (
	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/flow"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/mcp"
	"github.com/pentagron/pentagron/pkg/memory"
	"github.com/pentagron/pentagron/pkg/ws"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Deps holds all dependencies injected into HTTP handlers.
type Deps struct {
	Config     *config.Config
	DB         *gorm.DB
	LLMMgr     *llm.Manager
	MCPMgr     *mcp.Manager
	MemMgr     *memory.Manager
	Hub        *ws.Hub
	FlowEngine *flow.FlowEngine
	Log        *zap.Logger
}
