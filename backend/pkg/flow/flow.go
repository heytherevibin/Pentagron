package flow

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/pentagron/pentagron/pkg/database"
	"github.com/pentagron/pentagron/pkg/ws"
)

// phaseOrder defines the canonical execution sequence for all engagement phases.
var phaseOrder = []string{
	"recon",
	"analysis",
	"exploitation",
	"post_exploitation",
	"reporting",
	"cleanup",
}

// phasesRequiringApproval lists phases that must pause for human review before proceeding.
var phasesRequiringApproval = map[string]bool{
	"exploitation": true,
}

// approvalPollInterval is how often waitForApproval checks the DB while polling.
const approvalPollInterval = 5 * time.Second

// approvalTimeout is the maximum time waitForApproval will block waiting for a human
// decision before it automatically cancels the flow to prevent an indefinite hang.
const approvalTimeout = 24 * time.Hour

// FlowEngine executes a single Flow through its phase state machine.
// Create one per server instance and reuse it across all flows.
type FlowEngine struct {
	db         *gorm.DB
	runner     *TaskRunner
	hub        *ws.Hub
	log        *zap.Logger
	cancelFuncs sync.Map // flowID string → context.CancelFunc
	approvalChs sync.Map // flowID string → chan struct{}
}

// NewFlowEngine constructs a FlowEngine with all required dependencies.
func NewFlowEngine(db *gorm.DB, runner *TaskRunner, hub *ws.Hub, log *zap.Logger) *FlowEngine {
	return &FlowEngine{
		db:     db,
		runner: runner,
		hub:    hub,
		log:    log,
	}
}

// Start launches Run in a background goroutine and stores a cancel function.
// The goroutine is cancelled via Cancel(flowID). Safe to call from HTTP handlers.
func (e *FlowEngine) Start(flowID string) {
	ctx, cancel := context.WithCancel(context.Background())
	e.cancelFuncs.Store(flowID, cancel)

	go func() {
		defer e.cancelFuncs.Delete(flowID)
		if err := e.Run(ctx, flowID); err != nil {
			e.log.Error("flow engine error",
				zap.String("flow_id", flowID),
				zap.Error(err),
			)
		}
	}()
}

// Cancel cancels a running flow by calling its stored cancel function.
func (e *FlowEngine) Cancel(flowID string) {
	if fn, ok := e.cancelFuncs.Load(flowID); ok {
		fn.(context.CancelFunc)()
	}
}

// NotifyApproval signals the waitForApproval poller that an approval decision was made.
// The caller (ApprovePhase/RejectPhase handler) must update the DB before calling this.
func (e *FlowEngine) NotifyApproval(flowID string) {
	if ch, ok := e.approvalChs.Load(flowID); ok {
		select {
		case ch.(chan struct{}) <- struct{}{}:
		default:
		}
	}
}

// Run is the core state machine. It advances the flow through phaseOrder,
// pausing for approvals as required, until all phases complete or ctx is cancelled.
func (e *FlowEngine) Run(ctx context.Context, flowID string) error {
	var flow database.Flow
	if err := e.db.WithContext(ctx).Preload("Project").First(&flow, "id = ?", flowID).Error; err != nil {
		return fmt.Errorf("load flow: %w", err)
	}

	if flow.Project == nil {
		var project database.Project
		if err := e.db.WithContext(ctx).First(&project, "id = ?", flow.ProjectID).Error; err != nil {
			return fmt.Errorf("load project: %w", err)
		}
		flow.Project = &project
	}

	projectID := flow.ProjectID.String()
	scope := flow.Project.Scope
	objective := flow.Objective

	// Mark flow as running
	if err := e.setFlowStatus(ctx, flowID, database.FlowStatusRunning, flow.Phase); err != nil {
		return fmt.Errorf("set running: %w", err)
	}

	// Find the starting index in phaseOrder
	startIdx := 0
	for i, p := range phaseOrder {
		if p == flow.Phase {
			startIdx = i
			break
		}
	}

	for _, phase := range phaseOrder[startIdx:] {
		select {
		case <-ctx.Done():
			_ = e.setFlowStatus(ctx, flowID, database.FlowStatusCancelled, phase)
			return nil
		default:
		}

		e.log.Info("starting phase", zap.String("flow_id", flowID), zap.String("phase", phase))
		e.broadcastPhaseChange(flowID, phase, "started")

		// Pause for approval if required
		if phasesRequiringApproval[phase] {
			if err := e.waitForApproval(ctx, flowID, phase, objective); err != nil {
				if err == context.Canceled {
					_ = e.setFlowStatus(ctx, flowID, database.FlowStatusCancelled, phase)
					return nil
				}
				return fmt.Errorf("wait approval (phase=%s): %w", phase, err)
			}
			// Re-check context after blocking
			select {
			case <-ctx.Done():
				_ = e.setFlowStatus(ctx, flowID, database.FlowStatusCancelled, phase)
				return nil
			default:
			}
		}

		// Dispatch phase execution
		taskDesc := PhaseDescription(phase, objective, scope)
		var phaseErr error
		switch phase {
		case "post_exploitation":
			// Post-exploitation uses the dedicated post_exploitation agent which has
			// access to session management tools (msf_sessions_list, msf_session_cmd).
			// It auto-runs after the exploitation approval — no second approval gate.
			e.log.Info("dispatching post-exploitation agent", zap.String("flow_id", flowID))
			_, phaseErr = e.runner.Run(ctx, flowID, PhaseAgent[phase], phase, taskDesc, projectID)
		default:
			_, phaseErr = e.runner.Run(ctx, flowID, PhaseAgent[phase], phase, taskDesc, projectID)
		}

		if phaseErr != nil {
			e.log.Warn("phase execution error",
				zap.String("flow_id", flowID),
				zap.String("phase", phase),
				zap.Error(phaseErr),
			)
			e.broadcastPhaseChange(flowID, phase, "failed")

			// Fatal: if all LLM providers are unreachable, abort the entire flow
			// instead of burning through every phase with the same error.
			if strings.Contains(phaseErr.Error(), "all LLM providers failed") {
				_ = e.setFlowStatus(ctx, flowID, database.FlowStatusFailed, phase)
				return fmt.Errorf("flow aborted: %w", phaseErr)
			}
			// Non-fatal tool/agent errors: log and continue to next phase
		} else {
			e.broadcastPhaseChange(flowID, phase, "completed")
		}

		// Advance phase in DB
		if err := e.setFlowStatus(ctx, flowID, database.FlowStatusRunning, phase); err != nil {
			e.log.Warn("failed to update flow phase", zap.Error(err))
		}
	}

	// All phases complete
	if err := e.setFlowStatus(ctx, flowID, database.FlowStatusCompleted, "cleanup"); err != nil {
		e.log.Warn("failed to mark flow completed", zap.Error(err))
	}
	e.broadcastPhaseChange(flowID, "completed", "completed")
	e.log.Info("flow completed", zap.String("flow_id", flowID))
	return nil
}

// waitForApproval creates an ApprovalRequest, pauses the flow, and waits for a decision.
// Returns nil on approval, context.Canceled on cancellation or rejection.
func (e *FlowEngine) waitForApproval(ctx context.Context, flowID, phase, objective string) error {
	flowUUID, err := uuid.Parse(flowID)
	if err != nil {
		return fmt.Errorf("parse flow id: %w", err)
	}

	payload, _ := json.Marshal(map[string]string{
		"phase":     phase,
		"objective": objective,
	})

	approval := database.ApprovalRequest{
		FlowID:      flowUUID,
		Phase:       phase,
		Description: fmt.Sprintf("Agent requests permission to begin the %s phase.", phase),
		Payload:     string(payload),
		Status:      database.ApprovalStatusPending,
	}
	if err := e.db.WithContext(ctx).Create(&approval).Error; err != nil {
		return fmt.Errorf("create approval request: %w", err)
	}

	// Pause the flow
	if err := e.setFlowStatus(ctx, flowID, database.FlowStatusPaused, phase); err != nil {
		return fmt.Errorf("set paused: %w", err)
	}

	// Notify frontend
	e.hub.Broadcast(flowID, ws.Message{
		Type:   ws.TypeApproval,
		FlowID: flowID,
		Payload: map[string]interface{}{
			"approval_id": approval.ID.String(),
			"phase":       phase,
			"description": approval.Description,
		},
	})

	// Set up notification channel
	ch := make(chan struct{}, 1)
	e.approvalChs.Store(flowID, ch)
	defer e.approvalChs.Delete(flowID)

	ticker := time.NewTicker(approvalPollInterval)
	defer ticker.Stop()

	deadline := time.NewTimer(approvalTimeout)
	defer deadline.Stop()

	for {
		select {
		case <-ctx.Done():
			return context.Canceled
		case <-deadline.C:
			e.log.Warn("approval timed out — cancelling flow",
				zap.String("flow_id", flowID),
				zap.String("phase", phase),
				zap.Duration("timeout", approvalTimeout),
			)
			_ = e.setFlowStatus(ctx, flowID, database.FlowStatusCancelled, phase)
			return context.Canceled
		case <-ch:
			// Signal received — check DB immediately
		case <-ticker.C:
			// Periodic fallback check
		}

		var latest database.ApprovalRequest
		if err := e.db.WithContext(ctx).
			Where("flow_id = ? AND phase = ?", flowID, phase).
			Order("created_at DESC").
			First(&latest).Error; err != nil {
			continue
		}

		switch latest.Status {
		case database.ApprovalStatusApproved:
			// Resume the flow
			if err := e.setFlowStatus(ctx, flowID, database.FlowStatusRunning, phase); err != nil {
				e.log.Warn("failed to set running after approval", zap.Error(err))
			}
			return nil
		case database.ApprovalStatusRejected:
			_ = e.setFlowStatus(ctx, flowID, database.FlowStatusCancelled, phase)
			return context.Canceled
		}
	}
}

// setFlowStatus updates the flow's status and current phase in Postgres.
func (e *FlowEngine) setFlowStatus(ctx context.Context, flowID string, status database.FlowStatus, phase string) error {
	updates := map[string]interface{}{
		"status":     status,
		"phase":      phase,
		"updated_at": time.Now(),
	}
	if status == database.FlowStatusCompleted {
		now := time.Now()
		updates["completed_at"] = now
	}
	if err := e.db.WithContext(ctx).
		Model(&database.Flow{}).
		Where("id = ?", flowID).
		Updates(updates).Error; err != nil {
		return err
	}
	// Set started_at only on the first transition to running (idempotent).
	if status == database.FlowStatusRunning {
		e.db.WithContext(ctx).Exec(
			"UPDATE flows SET started_at = NOW() WHERE id = ? AND started_at IS NULL",
			flowID,
		)
	}
	return nil
}

// broadcastPhaseChange sends a TypePhaseChange WS event to all flow subscribers.
func (e *FlowEngine) broadcastPhaseChange(flowID, phase, status string) {
	e.hub.Broadcast(flowID, ws.Message{
		Type:   ws.TypePhaseChange,
		FlowID: flowID,
		Payload: map[string]string{
			"phase":  phase,
			"status": status,
		},
	})
}
