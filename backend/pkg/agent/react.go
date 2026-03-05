package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/llm"
	"github.com/pentagron/pentagron/pkg/memory"
	"github.com/pentagron/pentagron/pkg/tools"
)

// ── Types ──────────────────────────────────────────────────────────────────────

// Step records a single iteration of the ReAct loop.
type Step struct {
	Iteration int
	Thought   string
	ToolCalls []llm.ToolCall
	ToolResults []ToolResult
	Timestamp  time.Time
}

// ToolResult is the output of a single tool execution.
type ToolResult struct {
	ToolCallID string
	ToolName   string
	Output     string
	Success    bool
	Duration   time.Duration
}

// AgentResult is the final output of a completed ReAct loop.
type AgentResult struct {
	SessionID     string
	ChainID       string // EvoGraph AttackChain node ID for cross-session linking
	FinalAnswer   string
	Steps         []Step
	TotalDuration time.Duration
	TokensUsed    llm.Usage
}

// Config controls the behaviour of a ReActAgent.
type Config struct {
	MaxIterations int
	Model         string
	Provider      string    // LLM provider name
	AgentType     AgentType // determines prompt template
	SessionID     string    // links to Neo4j EvoGraph chain
	ProjectID     string
}

// ── ReActAgent ────────────────────────────────────────────────────────────────

// ReActAgent implements the Reasoning + Acting (ReAct) pattern.
// Each iteration: build prompt → LLM call → parse tools → execute → observe → repeat.
type ReActAgent struct {
	cfg        Config
	llmMgr     *llm.Manager
	registry   *tools.Registry
	memory     *memory.Manager
	evograph   *memory.EvoGraph
	reflector  *Reflector
	summarizer *Summarizer
	log        *zap.Logger
	eventSink  EventSink // optional; set via WithEventSink for streaming

	// Conversation state
	messages []llm.Message
	steps    []Step
	usage    llm.Usage
}

// NewReActAgent creates a new agent instance.
func NewReActAgent(
	cfg Config,
	llmMgr *llm.Manager,
	registry *tools.Registry,
	mem *memory.Manager,
	evograph *memory.EvoGraph,
	log *zap.Logger,
) *ReActAgent {
	if cfg.MaxIterations == 0 {
		cfg.MaxIterations = 50
	}
	if cfg.SessionID == "" {
		cfg.SessionID = uuid.New().String()
	}

	return &ReActAgent{
		cfg:        cfg,
		llmMgr:     llmMgr,
		registry:   registry,
		memory:     mem,
		evograph:   evograph,
		reflector:  NewReflector(log),
		summarizer: NewSummarizer(llmMgr, log),
		log:        log,
	}
}

// WithEventSink attaches an optional event sink for streaming agent activity.
// Must be called before Run.
func (a *ReActAgent) WithEventSink(sink EventSink) *ReActAgent {
	a.eventSink = sink
	return a
}

// emitEvent sends a StepEvent to the registered sink if one is set.
func (a *ReActAgent) emitEvent(e StepEvent) {
	if a.eventSink != nil {
		a.eventSink(e)
	}
}

// Run executes the ReAct loop until the agent calls the `finish` tool,
// reaches MaxIterations, or ctx is cancelled.
func (a *ReActAgent) Run(ctx context.Context, task string) (*AgentResult, error) {
	start := time.Now()

	// Build system prompt from template
	systemPrompt, err := LoadPrompt(a.cfg.AgentType, PromptData{
		Task:     task,
		Phase:    "recon",
		EvoGraph: a.evograph.FormatContext(ctx),
	})
	if err != nil {
		return nil, fmt.Errorf("load prompt: %w", err)
	}

	// Inject EvoGraph context as user message
	a.messages = []llm.Message{
		{Role: llm.RoleUser, Content: task},
	}

	// Record chain start in EvoGraph; returned in AgentResult so callers can link
	// the flow DB record to the EvoGraph AttackChain node for cross-session queries.
	chainID := a.evograph.StartChain(ctx, a.cfg.SessionID, a.cfg.ProjectID, task)

	// Get tool definitions scoped to current phase
	toolDefs := a.registry.ToolDefinitions(a.cfg.AgentType)

	var finalAnswer string

	for i := 0; i < a.cfg.MaxIterations; i++ {
		// Exit immediately if the context has been cancelled (flow cancelled, server shutdown).
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		step := Step{Iteration: i + 1, Timestamp: time.Now()}

		req := llm.ChatRequest{
			Model:        a.cfg.Model,
			Messages:     a.messages,
			Tools:        toolDefs,
			SystemPrompt: systemPrompt,
			MaxTokens:    8192,
		}

		resp, err := a.llmMgr.Chat(ctx, a.cfg.Provider, req)
		if err != nil {
			return nil, fmt.Errorf("iteration %d LLM call: %w", i+1, err)
		}

		a.usage.InputTokens += resp.Usage.InputTokens
		a.usage.OutputTokens += resp.Usage.OutputTokens

		// Detect free-text drift (agent forgot to use tools)
		if a.reflector.ShouldRedirect(resp) {
			a.log.Warn("reflector: free-text response detected, redirecting",
				zap.Int("iteration", i+1))
			redirectMsg := a.reflector.BuildRedirectMessage()
			a.messages = append(a.messages, llm.Message{
				Role:    llm.RoleAssistant,
				Content: resp.Content,
			}, redirectMsg)
			continue
		}

		// Record thought in EvoGraph
		step.Thought = resp.Content
		if resp.Content != "" {
			a.evograph.RecordStep(ctx, a.cfg.SessionID, resp.Content, i+1)
			a.emitEvent(StepEvent{Type: "thought", Thought: resp.Content, Iteration: i + 1})
		}

		// Append assistant turn
		a.messages = append(a.messages, llm.Message{
			Role:      llm.RoleAssistant,
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		if !resp.HasToolCalls() {
			// No tool calls and no redirect — agent is done
			finalAnswer = resp.Content
			break
		}

		// Execute all tool calls
		for _, tc := range resp.ToolCalls {
			a.emitEvent(StepEvent{Type: "tool_call", ToolName: tc.Name, ToolInput: tc.Input, Iteration: i + 1})
			result := a.executeTool(ctx, tc)
			step.ToolCalls = append(step.ToolCalls, tc)
			step.ToolResults = append(step.ToolResults, result)

			a.emitEvent(StepEvent{
				Type:      "tool_result",
				ToolName:  tc.Name,
				Output:    result.Output,
				Success:   result.Success,
				Iteration: i + 1,
			})

			// Append tool result to conversation
			a.messages = append(a.messages, llm.ToolResultMessage(tc.ID, result.Output))

			// Record in EvoGraph
			if result.Success {
				a.evograph.RecordFinding(ctx, a.cfg.SessionID, tc.Name, result.Output)
			} else {
				a.evograph.RecordFailure(ctx, a.cfg.SessionID, tc.Name, result.Output)
			}

			// Check for finish signal
			if tc.Name == "finish" {
				var finishInput struct{ Answer string }
				_ = json.Unmarshal(tc.Input, &finishInput)
				finalAnswer = finishInput.Answer
				a.emitEvent(StepEvent{Type: "final_answer", Output: finalAnswer, Iteration: i + 1})
				goto done
			}
		}

		a.steps = append(a.steps, step)

		// Summarize context if approaching token limits
		if err := a.summarizer.MaybeSummarize(ctx, &a.messages, a.cfg.Model, a.cfg.Provider); err != nil {
			a.log.Warn("summarizer error", zap.Error(err))
		}
	}

done:
	return &AgentResult{
		SessionID:     a.cfg.SessionID,
		ChainID:       chainID,
		FinalAnswer:   finalAnswer,
		Steps:         a.steps,
		TotalDuration: time.Since(start),
		TokensUsed:    a.usage,
	}, nil
}

// executeTool runs a single tool call through the tool registry.
func (a *ReActAgent) executeTool(ctx context.Context, tc llm.ToolCall) ToolResult {
	start := time.Now()
	result := ToolResult{
		ToolCallID: tc.ID,
		ToolName:   tc.Name,
	}

	a.log.Info("executing tool",
		zap.String("tool", tc.Name),
		zap.String("session", a.cfg.SessionID),
	)

	output, err := a.registry.Execute(ctx, tc.Name, tc.Input)
	result.Duration = time.Since(start)

	if err != nil {
		result.Output = fmt.Sprintf("ERROR: %v", err)
		result.Success = false
		a.log.Warn("tool execution failed",
			zap.String("tool", tc.Name),
			zap.Error(err),
		)
	} else {
		result.Output = output
		result.Success = true
	}

	return result
}
