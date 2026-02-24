package memory

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"go.uber.org/zap"
)

// ── EvoGraph node types ───────────────────────────────────────────────────────
//
// EvoGraph persists the full attack chain intelligence across sessions.
// Every event is dual-recorded:
//   1. In-memory slice  → immediate LLM context via FormatContext()
//   2. Neo4j graph      → cross-session queries via QueryPriorChains()
//
// Pentagron EvoGraph node types:
//   AttackChain   — root node per session
//   ChainStep     — individual reasoning / action
//   ChainFinding  — discovery (credential, vuln, host) — sorted by severity
//   ChainDecision — agent rationale for phase transitions
//   ChainFailure  — failed attempt with lesson_learned

// Severity levels for findings
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityHigh     Severity = "high"
	SeverityMedium   Severity = "medium"
	SeverityLow      Severity = "low"
	SeverityInfo     Severity = "info"
)

// chainEntry is an in-memory record of any chain event.
type chainEntry struct {
	ID        string
	Type      string // step | finding | decision | failure
	Content   string
	Tool      string
	Severity  Severity
	Lesson    string
	CreatedAt time.Time
}

// EvoGraph manages attack chain intelligence for the current and future sessions.
type EvoGraph struct {
	neo4j  neo4j.DriverWithContext
	log    *zap.Logger
	mu     sync.Mutex
	chains map[string][]chainEntry // sessionID → entries
}

// NewEvoGraph creates a new EvoGraph backed by Neo4j.
func NewEvoGraph(driver neo4j.DriverWithContext, log *zap.Logger) *EvoGraph {
	return &EvoGraph{
		neo4j:  driver,
		log:    log,
		chains: make(map[string][]chainEntry),
	}
}

// StartChain creates the root AttackChain node in Neo4j and in-memory.
func (e *EvoGraph) StartChain(ctx context.Context, sessionID, projectID, objective string) string {
	chainID := uuid.New().String()
	e.mu.Lock()
	e.chains[sessionID] = []chainEntry{}
	e.mu.Unlock()

	session := e.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	_, err := session.Run(ctx, `
		CREATE (c:AttackChain {
			id: $id,
			session_id: $session_id,
			project_id: $project_id,
			objective: $objective,
			created_at: $created_at
		})`,
		map[string]interface{}{
			"id":         chainID,
			"session_id": sessionID,
			"project_id": projectID,
			"objective":  objective,
			"created_at": time.Now().UTC().Format(time.RFC3339),
		},
	)
	if err != nil {
		e.log.Warn("evograph: failed to create AttackChain", zap.Error(err))
	}
	return chainID
}

// RecordStep records a reasoning step (thought) in the chain.
func (e *EvoGraph) RecordStep(ctx context.Context, sessionID, content string, iteration int) {
	id := uuid.New().String()
	e.append(sessionID, chainEntry{
		ID: id, Type: "step", Content: content, CreatedAt: time.Now(),
	})

	e.writeNode(ctx, "ChainStep", sessionID, map[string]interface{}{
		"id":         id,
		"session_id": sessionID,
		"content":    truncate(content, 2000),
		"iteration":  iteration,
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

// RecordFinding records a successful discovery (credential, vuln, service).
func (e *EvoGraph) RecordFinding(ctx context.Context, sessionID, toolName, output string) {
	id := uuid.New().String()
	entry := chainEntry{
		ID: id, Type: "finding", Tool: toolName,
		Content: output, Severity: SeverityInfo, CreatedAt: time.Now(),
	}
	e.append(sessionID, entry)

	e.writeNode(ctx, "ChainFinding", sessionID, map[string]interface{}{
		"id":         id,
		"session_id": sessionID,
		"tool":       toolName,
		"output":     truncate(output, 2000),
		"severity":   string(SeverityInfo),
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

// RecordFindingWithSeverity records a finding with explicit severity.
func (e *EvoGraph) RecordFindingWithSeverity(ctx context.Context, sessionID, toolName, output string, severity Severity) {
	id := uuid.New().String()
	e.append(sessionID, chainEntry{
		ID: id, Type: "finding", Tool: toolName,
		Content: output, Severity: severity, CreatedAt: time.Now(),
	})

	e.writeNode(ctx, "ChainFinding", sessionID, map[string]interface{}{
		"id":         id,
		"session_id": sessionID,
		"tool":       toolName,
		"output":     truncate(output, 2000),
		"severity":   string(severity),
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

// RecordDecision records the agent's rationale for a phase transition.
func (e *EvoGraph) RecordDecision(ctx context.Context, sessionID, rationale, fromPhase, toPhase string) {
	id := uuid.New().String()
	content := fmt.Sprintf("Phase transition %s→%s: %s", fromPhase, toPhase, rationale)
	e.append(sessionID, chainEntry{ID: id, Type: "decision", Content: content, CreatedAt: time.Now()})

	e.writeNode(ctx, "ChainDecision", sessionID, map[string]interface{}{
		"id":         id,
		"session_id": sessionID,
		"rationale":  rationale,
		"from_phase": fromPhase,
		"to_phase":   toPhase,
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

// RecordFailure records a failed tool attempt with a lesson learned.
func (e *EvoGraph) RecordFailure(ctx context.Context, sessionID, toolName, errorMsg string) {
	id := uuid.New().String()
	lesson := fmt.Sprintf("Tool %q failed: %s — avoid repeating this approach.", toolName, truncate(errorMsg, 200))
	e.append(sessionID, chainEntry{
		ID: id, Type: "failure", Tool: toolName,
		Content: errorMsg, Lesson: lesson, CreatedAt: time.Now(),
	})

	e.writeNode(ctx, "ChainFailure", sessionID, map[string]interface{}{
		"id":             id,
		"session_id":     sessionID,
		"tool":           toolName,
		"error":          truncate(errorMsg, 2000),
		"lesson_learned": lesson,
		"created_at":     time.Now().UTC().Format(time.RFC3339),
	})
}

// FormatContext returns a semantically partitioned string for LLM injection.
// Findings are sorted critical-first; failures include lessons learned.
func (e *EvoGraph) FormatContext(ctx context.Context) string {
	// Also pull cross-session data from Neo4j
	prior := e.queryPriorChains(ctx)

	var sb strings.Builder
	if prior != "" {
		sb.WriteString("=== PRIOR SESSION INTELLIGENCE ===\n")
		sb.WriteString(prior)
		sb.WriteString("\n\n")
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	var findings, failures, decisions []chainEntry
	for _, entries := range e.chains {
		for _, entry := range entries {
			switch entry.Type {
			case "finding":
				findings = append(findings, entry)
			case "failure":
				failures = append(failures, entry)
			case "decision":
				decisions = append(decisions, entry)
			}
		}
	}

	if len(findings) > 0 {
		sb.WriteString("=== CURRENT SESSION FINDINGS ===\n")
		for _, f := range severitySorted(findings) {
			sb.WriteString(fmt.Sprintf("[%s][%s] %s\n", strings.ToUpper(string(f.Severity)), f.Tool, f.Content))
		}
		sb.WriteString("\n")
	}

	if len(failures) > 0 {
		sb.WriteString("=== FAILED ATTEMPTS (DO NOT REPEAT) ===\n")
		for _, f := range failures {
			sb.WriteString(fmt.Sprintf("- %s\n", f.Lesson))
		}
		sb.WriteString("\n")
	}

	if len(decisions) > 0 {
		sb.WriteString("=== PHASE DECISIONS ===\n")
		for _, d := range decisions {
			sb.WriteString(fmt.Sprintf("- %s\n", d.Content))
		}
	}

	return sb.String()
}

// QueryPriorChains retrieves successful findings from prior sessions for the same project.
func (e *EvoGraph) queryPriorChains(ctx context.Context) string {
	session := e.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (f:ChainFinding)
		WHERE f.severity IN ['critical', 'high']
		RETURN f.tool AS tool, f.output AS output, f.severity AS severity
		ORDER BY f.created_at DESC LIMIT 20`,
		nil,
	)
	if err != nil {
		return ""
	}

	var lines []string
	for result.Next(ctx) {
		rec := result.Record()
		tool, _ := rec.Get("tool")
		output, _ := rec.Get("output")
		sev, _ := rec.Get("severity")
		lines = append(lines, fmt.Sprintf("[%v][%v] %v", sev, tool, output))
	}
	return strings.Join(lines, "\n")
}

// ── Internal helpers ──────────────────────────────────────────────────────────

func (e *EvoGraph) append(sessionID string, entry chainEntry) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.chains[sessionID] = append(e.chains[sessionID], entry)
}

func (e *EvoGraph) writeNode(ctx context.Context, label, sessionID string, props map[string]interface{}) {
	session := e.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	// Build Cypher props string dynamically
	query := fmt.Sprintf("CREATE (n:%s $props) WITH n MATCH (c:AttackChain {session_id: $session_id}) CREATE (c)-[:HAS_NODE]->(n)", label)
	_, err := session.Run(ctx, query, map[string]interface{}{
		"props":      props,
		"session_id": sessionID,
	})
	if err != nil {
		e.log.Warn("evograph: write node failed",
			zap.String("label", label),
			zap.Error(err),
		)
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

func severitySorted(findings []chainEntry) []chainEntry {
	order := map[Severity]int{
		SeverityCritical: 0, SeverityHigh: 1,
		SeverityMedium: 2, SeverityLow: 3, SeverityInfo: 4,
	}
	sorted := make([]chainEntry, len(findings))
	copy(sorted, findings)
	// Simple insertion sort by severity
	for i := 1; i < len(sorted); i++ {
		for j := i; j > 0 && order[sorted[j].Severity] < order[sorted[j-1].Severity]; j-- {
			sorted[j], sorted[j-1] = sorted[j-1], sorted[j]
		}
	}
	return sorted
}
