package flow

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/pentagron/pentagron/pkg/agent"
	"github.com/pentagron/pentagron/pkg/config"
	"github.com/pentagron/pentagron/pkg/database"
	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/memory"
	"github.com/pentagron/pentagron/pkg/tools"
	"github.com/pentagron/pentagron/pkg/ws"
)

// TaskRunner creates Task records, dispatches ReAct agents, and persists results.
type TaskRunner struct {
	db       *gorm.DB
	llmMgr   *llm.Manager
	registry *tools.Registry
	memory   *memory.Manager
	hub      *ws.Hub
	cfg      *config.Config
	log      *zap.Logger
}

// NewTaskRunner constructs a TaskRunner with all required dependencies.
func NewTaskRunner(
	db *gorm.DB,
	llmMgr *llm.Manager,
	registry *tools.Registry,
	mem *memory.Manager,
	hub *ws.Hub,
	cfg *config.Config,
	log *zap.Logger,
) *TaskRunner {
	return &TaskRunner{
		db:       db,
		llmMgr:   llmMgr,
		registry: registry,
		memory:   mem,
		hub:      hub,
		cfg:      cfg,
		log:      log,
	}
}

// Run creates a Task record, dispatches the appropriate ReAct agent, and persists the result.
// It streams agent thoughts and tool results to the ws.Hub for the given flowID.
func (r *TaskRunner) Run(
	ctx context.Context,
	flowID string,
	agentType agent.AgentType,
	phase string,
	taskDesc string,
	projectID string,
) (*agent.AgentResult, error) {
	flowUUID, err := uuid.Parse(flowID)
	if err != nil {
		return nil, fmt.Errorf("parse flow id: %w", err)
	}

	title := PhaseTaskTitle[phase]
	if title == "" {
		title = phase
	}

	now := time.Now()
	task := database.Task{
		FlowID:      flowUUID,
		AgentType:   string(agentType),
		Title:       title,
		Description: taskDesc,
		Status:      database.TaskStatusRunning,
		StartedAt:   &now,
	}
	if err := r.db.WithContext(ctx).Create(&task).Error; err != nil {
		return nil, fmt.Errorf("create task record: %w", err)
	}

	sessionID := uuid.New().String()

	// Build agent config
	agentCfg := agent.Config{
		MaxIterations: r.cfg.AgentMaxIterations,
		Model:         ModelForPhase(agentType, r.cfg),
		Provider:      r.cfg.LLMDefaultProvider,
		AgentType:     agentType,
		SessionID:     sessionID,
		ProjectID:     projectID,
	}
	if agentCfg.MaxIterations == 0 {
		agentCfg.MaxIterations = 50
	}
	if agentCfg.Provider == "" {
		agentCfg.Provider = "anthropic"
	}

	// Resolve EvoGraph (nil-safe)
	var evograph *memory.EvoGraph
	if r.memory != nil {
		evograph = r.memory.EvoGraph
	}
	if evograph == nil {
		evograph = memory.NewEvoGraph(nil, r.log)
	}

	// Build the event sink that streams events to the WS hub
	sink := r.buildEventSink(flowID, sessionID, phase)

	// Create and run the agent
	a := agent.NewReActAgent(agentCfg, r.llmMgr, r.registry, r.memory, evograph, r.log).
		WithEventSink(sink)

	result, err := a.Run(ctx, taskDesc)

	// Persist result regardless of error
	completed := time.Now()
	update := map[string]interface{}{
		"completed_at": completed,
		"updated_at":   completed,
	}
	if err != nil {
		update["status"] = database.TaskStatusFailed
		update["error_msg"] = err.Error()
	} else {
		update["status"] = database.TaskStatusCompleted
		update["result"] = result.FinalAnswer
	}
	r.db.WithContext(ctx).Model(&task).Updates(update)

	if err != nil {
		return nil, fmt.Errorf("agent run (phase=%s): %w", phase, err)
	}

	// Persist action records for each step
	r.persistActions(ctx, task.ID, result)

	return result, nil
}

// buildEventSink returns an EventSink that broadcasts agent events to the WS hub.
func (r *TaskRunner) buildEventSink(flowID, sessionID, phase string) agent.EventSink {
	return func(e agent.StepEvent) {
		var msgType ws.MessageType
		payload := map[string]interface{}{
			"phase":     phase,
			"iteration": e.Iteration,
		}

		switch e.Type {
		case "thought":
			msgType = ws.TypeAgentThought
			payload["thought"] = e.Thought
		case "tool_call":
			msgType = ws.TypeToolCall
			payload["tool_name"] = e.ToolName
			payload["input"] = e.ToolInput
		case "tool_result":
			msgType = ws.TypeToolResult
			payload["tool_name"] = e.ToolName
			payload["output"] = e.Output
			payload["success"] = e.Success
		case "final_answer":
			msgType = ws.TypeFinalAnswer
			payload["answer"] = e.Output
		default:
			return
		}

		r.hub.Broadcast(flowID, ws.Message{
			Type:      msgType,
			SessionID: sessionID,
			FlowID:    flowID,
			Payload:   payload,
		})
	}
}

// persistActions inserts Action records for each tool call in the agent result.
func (r *TaskRunner) persistActions(ctx context.Context, taskID uuid.UUID, result *agent.AgentResult) {
	for _, step := range result.Steps {
		for i, tc := range step.ToolCalls {
			action := database.Action{
				TaskID:   taskID,
				Type:     "tool_call",
				ToolName: tc.Name,
				Input:    string(tc.Input),
			}
			if i < len(step.ToolResults) {
				tr := step.ToolResults[i]
				action.Output = tr.Output
				action.Success = tr.Success
				action.Duration = tr.Duration.Milliseconds()
			}
			if err := r.db.WithContext(ctx).Create(&action).Error; err != nil {
				r.log.Warn("failed to persist action", zap.String("tool", tc.Name), zap.Error(err))
			}
		}
	}
}

// ModelForPhase returns the configured model for an agent type,
// falling back to agent.ModelForAgent defaults if no override is set.
func ModelForPhase(agentType agent.AgentType, cfg *config.Config) string {
	var override string
	switch agentType {
	case agent.AgentTypeOrchestrator:
		override = cfg.AgentModelOrchestrator
	case agent.AgentTypePentester:
		override = cfg.AgentModelPentester
	case agent.AgentTypeRecon:
		override = cfg.AgentModelRecon
	case agent.AgentTypeCoder:
		override = cfg.AgentModelCoder
	case agent.AgentTypeReporter:
		override = cfg.AgentModelReporter
	case agent.AgentTypeSummarizer:
		override = cfg.AgentModelSummarizer
	}
	if override != "" {
		return override
	}
	return agent.ModelForAgent(agentType)
}
