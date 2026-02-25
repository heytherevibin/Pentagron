package flow

import (
	"fmt"

	"github.com/pentagron/pentagron/pkg/agent"
)

// PhaseAgent maps each engagement phase to the primary agent type responsible for it.
var PhaseAgent = map[string]agent.AgentType{
	"recon":            agent.AgentTypeRecon,
	"analysis":         agent.AgentTypePentester,
	"exploitation":     agent.AgentTypePentester,
	"post_exploitation": agent.AgentTypePentester,
	"reporting":        agent.AgentTypeReporter,
	"cleanup":          agent.AgentTypeRecon,
}

// PhaseTaskTitle returns a human-readable title for the Task DB record created per phase.
var PhaseTaskTitle = map[string]string{
	"recon":            "Passive & Active Reconnaissance",
	"analysis":         "Attack Surface Analysis",
	"exploitation":     "Vulnerability Exploitation",
	"post_exploitation": "Post-Exploitation Operations",
	"reporting":        "Findings Report Generation",
	"cleanup":          "Session Cleanup",
}

// PhaseDescription builds the task description/objective string passed to the agent.
// It interpolates the flow's objective and project scope into a phase-specific prompt.
func PhaseDescription(phase, objective, scope string) string {
	switch phase {
	case "recon":
		return fmt.Sprintf(
			"Perform comprehensive reconnaissance on the target scope.\n\nTarget scope: %s\nEngagement objective: %s\n\n"+
				"Use all available recon tools (port scanning, subdomain enumeration, HTTP probing, "+
				"resource enumeration, vulnerability scanning). Accumulate and report all findings.",
			scope, objective,
		)
	case "analysis":
		return fmt.Sprintf(
			"Analyse the reconnaissance findings and map the full attack surface.\n\nTarget scope: %s\nEngagement objective: %s\n\n"+
				"Prioritise findings by severity, identify exploitable vulnerabilities, and determine "+
				"the most promising attack paths. Use vuln scanning tools to confirm findings.",
			scope, objective,
		)
	case "exploitation":
		return fmt.Sprintf(
			"Exploit the highest-priority vulnerabilities identified in the analysis phase.\n\nTarget scope: %s\nEngagement objective: %s\n\n"+
				"Use Metasploit modules, SQL injection tools, or shell commands as appropriate. "+
				"Document all successful and failed exploitation attempts with full details.",
			scope, objective,
		)
	case "post_exploitation":
		return fmt.Sprintf(
			"Perform post-exploitation operations on compromised systems.\n\nTarget scope: %s\nEngagement objective: %s\n\n"+
				"Enumerate active sessions, gather credentials, perform privilege escalation where possible, "+
				"and document all post-exploitation findings.",
			scope, objective,
		)
	case "reporting":
		return fmt.Sprintf(
			"Generate a comprehensive penetration testing report.\n\nTarget scope: %s\nEngagement objective: %s\n\n"+
				"Summarise all findings from every phase. Include: executive summary, technical findings "+
				"(sorted by severity), evidence, and remediation recommendations.",
			scope, objective,
		)
	case "cleanup":
		return fmt.Sprintf(
			"Clean up all artifacts from this engagement.\n\nTarget scope: %s\n\n"+
				"Close active Metasploit sessions, remove any uploaded files, clear logs where applicable, "+
				"and confirm no persistent access remains.",
			scope,
		)
	default:
		return fmt.Sprintf("Execute the %s phase for scope: %s. Objective: %s", phase, scope, objective)
	}
}
