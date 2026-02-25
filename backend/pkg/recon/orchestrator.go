package recon

import (
	"context"
	"fmt"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/agent"
	"github.com/pentagron/pentagron/pkg/flow"
)

// SubPhase represents a discrete step within the recon phase.
type SubPhase string

const (
	SubPhaseDomainDiscovery SubPhase = "domain_discovery"
	SubPhasePortScan        SubPhase = "port_scan"
	SubPhaseHTTPProbe       SubPhase = "http_probe"
	SubPhaseResourceEnum    SubPhase = "resource_enum"
	SubPhaseVulnScan        SubPhase = "vuln_scan"
	SubPhaseSecretScan      SubPhase = "secret_scan"
)

// subPhaseOrder defines the sequential execution order within recon.
var subPhaseOrder = []SubPhase{
	SubPhaseDomainDiscovery,
	SubPhasePortScan,
	SubPhaseHTTPProbe,
	SubPhaseResourceEnum,
	SubPhaseVulnScan,
	SubPhaseSecretScan,
}

// Orchestrator coordinates the six recon sub-phases, passing accumulated
// context from each sub-phase to the next.
type Orchestrator struct {
	runner *flow.TaskRunner
	log    *zap.Logger
}

// NewOrchestrator creates a new recon Orchestrator.
func NewOrchestrator(runner *flow.TaskRunner, log *zap.Logger) *Orchestrator {
	return &Orchestrator{runner: runner, log: log}
}

// Run executes all six recon sub-phases sequentially.
// Each sub-phase's result is passed as accumulated context to subsequent phases.
// Individual sub-phase failures are non-fatal — they are logged and accumulated as errors.
// Returns the synthesised summary string for use as the recon phase result.
func (o *Orchestrator) Run(ctx context.Context, flowID, projectID, scope, objective string) (string, error) {
	accumulated := ""

	for _, sp := range subPhaseOrder {
		select {
		case <-ctx.Done():
			return accumulated, ctx.Err()
		default:
		}

		task := o.buildTask(sp, scope, objective, accumulated)

		o.log.Info("starting recon sub-phase",
			zap.String("flow_id", flowID),
			zap.String("sub_phase", string(sp)),
		)

		result, err := o.runner.Run(ctx, flowID, agent.AgentTypeRecon, "recon", task, projectID)
		if err != nil {
			o.log.Warn("recon sub-phase failed",
				zap.String("sub_phase", string(sp)),
				zap.Error(err),
			)
			accumulated += fmt.Sprintf("\n\n=== %s FAILED ===\nError: %s", sp, err.Error())
			continue
		}

		o.log.Info("recon sub-phase complete", zap.String("sub_phase", string(sp)))
		accumulated += fmt.Sprintf("\n\n=== %s RESULTS ===\n%s", sp, result.FinalAnswer)
	}

	// Synthesise a final summary via the Reporter agent
	summary, err := o.synthesise(ctx, flowID, projectID, scope, objective, accumulated)
	if err != nil {
		o.log.Warn("recon synthesis failed, returning raw accumulation", zap.Error(err))
		return accumulated, nil
	}
	return summary, nil
}

// buildTask returns the task description for a given recon sub-phase.
// It appends prior accumulated results so the agent has full context.
func (o *Orchestrator) buildTask(sp SubPhase, scope, objective, accumulated string) string {
	var description string
	switch sp {
	case SubPhaseDomainDiscovery:
		description = fmt.Sprintf(
			"Perform domain and subdomain enumeration on the target scope.\n\n"+
				"Target scope: %s\nObjective: %s\n\n"+
				"Use subfinder, amass, and DNS resolution tools. "+
				"List all discovered domains, subdomains, and IP addresses.",
			scope, objective,
		)
	case SubPhasePortScan:
		description = fmt.Sprintf(
			"Perform comprehensive port scanning on all discovered hosts.\n\n"+
				"Target scope: %s\nObjective: %s\n\n"+
				"Use naabu for fast port discovery. Scan common ports and service fingerprint. "+
				"Document all open ports and services.\n\nPrior recon context:\n%s",
			scope, objective, accumulated,
		)
	case SubPhaseHTTPProbe:
		description = fmt.Sprintf(
			"Probe all discovered hosts for HTTP/HTTPS services.\n\n"+
				"Target scope: %s\nObjective: %s\n\n"+
				"Identify web applications, response codes, technologies, and titles. "+
				"Use httpx or shell-based probing.\n\nPrior recon context:\n%s",
			scope, objective, accumulated,
		)
	case SubPhaseResourceEnum:
		description = fmt.Sprintf(
			"Enumerate web resources on all discovered web services.\n\n"+
				"Target scope: %s\nObjective: %s\n\n"+
				"Use gobuster or feroxbuster to discover directories, files, and API endpoints. "+
				"Focus on common paths and any custom wordlists available.\n\nPrior recon context:\n%s",
			scope, objective, accumulated,
		)
	case SubPhaseVulnScan:
		description = fmt.Sprintf(
			"Perform vulnerability scanning on all discovered services.\n\n"+
				"Target scope: %s\nObjective: %s\n\n"+
				"Use nuclei with relevant templates. Focus on critical and high severity findings. "+
				"Document all confirmed vulnerabilities with CVEs where applicable.\n\nPrior recon context:\n%s",
			scope, objective, accumulated,
		)
	case SubPhaseSecretScan:
		description = fmt.Sprintf(
			"Scan for exposed credentials, API keys, and sensitive information.\n\n"+
				"Target scope: %s\nObjective: %s\n\n"+
				"Check web responses, JavaScript files, and configuration endpoints for secrets. "+
				"Document any credentials, tokens, or sensitive data found.\n\nPrior recon context:\n%s",
			scope, objective, accumulated,
		)
	}
	return description
}

// synthesise calls the Reporter agent to produce a structured recon summary.
func (o *Orchestrator) synthesise(ctx context.Context, flowID, projectID, scope, objective, accumulated string) (string, error) {
	task := fmt.Sprintf(
		"Synthesise the following reconnaissance results into a structured report.\n\n"+
			"Target scope: %s\nObjective: %s\n\n"+
			"Include:\n"+
			"- Summary of discovered assets (hosts, domains, services)\n"+
			"- All vulnerabilities found, sorted by severity\n"+
			"- Key attack vectors identified\n"+
			"- Recommended next steps for exploitation\n\n"+
			"RAW RECON DATA:\n%s",
		scope, objective, accumulated,
	)

	result, err := o.runner.Run(ctx, flowID, agent.AgentTypeReporter, "recon", task, projectID)
	if err != nil {
		return "", fmt.Errorf("synthesise recon: %w", err)
	}
	return result.FinalAnswer, nil
}
