package agent

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
)

// AgentType identifies the role of an agent in the system.
type AgentType string

const (
	AgentTypePentester    AgentType = "pentester"
	AgentTypeCoder        AgentType = "coder"
	AgentTypeRecon        AgentType = "recon"
	AgentTypeReporter     AgentType = "reporter"
	AgentTypeOrchestrator AgentType = "primary_agent"
	AgentTypeSummarizer   AgentType = "summarizer"
)

// Phase represents the current operational phase of a flow.
type Phase string

const (
	PhaseRecon        Phase = "recon"
	PhaseAnalysis     Phase = "analysis"
	PhaseExploitation Phase = "exploitation"
	PhasePostExploit  Phase = "post_exploitation"
	PhaseReport       Phase = "report"
)

// AttackPath is the classified attack strategy.
type AttackPath string

const (
	AttackPathCVE       AttackPath = "cve_exploit"
	AttackPathBrute     AttackPath = "brute_force"
	AttackPathUnclassified AttackPath = "unclassified"
)

// PromptData is the context injected into prompt templates.
type PromptData struct {
	Task        string
	Phase       Phase
	AttackPath  AttackPath
	EvoGraph    string // formatted EvoGraph context from previous sessions
	TargetScope string
	Guidelines  string
}

//go:embed ../../templates/prompts/*.tmpl
var promptFS embed.FS

var promptCache = map[AgentType]*template.Template{}

// LoadPrompt renders the prompt template for the given agent type.
func LoadPrompt(agentType AgentType, data PromptData) (string, error) {
	tmpl, ok := promptCache[agentType]
	if !ok {
		path := fmt.Sprintf("../../templates/prompts/%s.tmpl", string(agentType))
		t, err := template.ParseFS(promptFS, path)
		if err != nil {
			return "", fmt.Errorf("parse prompt template %s: %w", agentType, err)
		}
		promptCache[agentType] = t
		tmpl = t
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute prompt template %s: %w", agentType, err)
	}
	return buf.String(), nil
}

// ModelForAgent returns the recommended model name for each agent tier.
// Callers should use config values; this is a safe fallback.
func ModelForAgent(agentType AgentType) string {
	switch agentType {
	case AgentTypeOrchestrator, AgentTypePentester:
		return "claude-opus-4-6"
	case AgentTypeRecon, AgentTypeCoder:
		return "claude-sonnet-4-6"
	case AgentTypeReporter, AgentTypeSummarizer:
		return "claude-haiku-4-5-20251001"
	default:
		return "claude-sonnet-4-6"
	}
}
