import type { FlowStatus, Phase, Severity, AttackPath } from '@/types'

/* ════════════════════════════════════════════════════════════════════════════
   Severity
   ════════════════════════════════════════════════════════════════════════════ */

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
  info:     'Info',
}

/** Tailwind class fragments used by Badge + StatusDot. */
export const SEVERITY_CLASSES: Record<Severity, { dot: string; text: string; bg: string; border: string }> = {
  critical: { dot: 'bg-sev-critical', text: 'text-sev-critical', bg: 'bg-sev-critical/10', border: 'border-sev-critical/25' },
  high:     { dot: 'bg-sev-high',     text: 'text-sev-high',     bg: 'bg-sev-high/10',     border: 'border-sev-high/25' },
  medium:   { dot: 'bg-sev-medium',   text: 'text-sev-medium',   bg: 'bg-sev-medium/10',   border: 'border-sev-medium/25' },
  low:      { dot: 'bg-sev-low',      text: 'text-sev-low',      bg: 'bg-sev-low/10',      border: 'border-sev-low/25' },
  info:     { dot: 'bg-sev-info',     text: 'text-sev-info',     bg: 'bg-sev-info/10',     border: 'border-sev-info/25' },
}

/* ════════════════════════════════════════════════════════════════════════════
   Flow status
   ════════════════════════════════════════════════════════════════════════════ */

export const STATUS_LABEL: Record<FlowStatus, string> = {
  pending:   'Pending',
  running:   'Running',
  paused:    'Paused',
  completed: 'Completed',
  failed:    'Failed',
  cancelled: 'Cancelled',
}

export const STATUS_CLASSES: Record<FlowStatus, { dot: string; text: string; bg: string; border: string; pulse?: boolean }> = {
  pending:   { dot: 'bg-fg-subtle',   text: 'text-fg-muted', bg: 'bg-fg-subtle/10',  border: 'border-border' },
  running:   { dot: 'bg-accent',      text: 'text-accent',   bg: 'bg-accent/10',     border: 'border-accent/25', pulse: true },
  paused:    { dot: 'bg-sev-medium',  text: 'text-sev-medium', bg: 'bg-sev-medium/10', border: 'border-sev-medium/25' },
  completed: { dot: 'bg-accent',      text: 'text-accent',   bg: 'bg-accent/10',     border: 'border-accent/25' },
  failed:    { dot: 'bg-sev-critical',text: 'text-sev-critical', bg: 'bg-sev-critical/10', border: 'border-sev-critical/25' },
  cancelled: { dot: 'bg-fg-subtle',   text: 'text-fg-subtle', bg: 'bg-fg-subtle/10',  border: 'border-border' },
}

/* ════════════════════════════════════════════════════════════════════════════
   Pipeline phases
   ════════════════════════════════════════════════════════════════════════════ */

export const PHASE_ORDER: Phase[] = [
  'recon',
  'analysis',
  'exploitation',
  'post_exploitation',
  'reporting',
  'cleanup',
]

export const PHASE_LABEL: Record<Phase, string> = {
  recon:             'Reconnaissance',
  analysis:          'Analysis',
  exploitation:      'Exploitation',
  post_exploitation: 'Post-Exploitation',
  reporting:         'Reporting',
  cleanup:           'Cleanup',
}

export const PHASE_SHORT: Record<Phase, string> = {
  recon:             'Recon',
  analysis:          'Analyze',
  exploitation:      'Exploit',
  post_exploitation: 'Post-Ex',
  reporting:         'Report',
  cleanup:           'Cleanup',
}

export const PHASE_DESCRIPTION: Record<Phase, string> = {
  recon:             'Domain discovery, port scanning, technology fingerprinting, vulnerability scanning',
  analysis:          'CVE correlation, attack-path classification, exploit feasibility scoring',
  exploitation:      'CVE-based exploits, credential attacks, web app attacks (requires approval)',
  post_exploitation: 'Session enumeration, privilege escalation, credential harvesting, lateral movement',
  reporting:         'MITRE ATT&CK mapping, CVSS scoring, compliance mapping, remediation roadmap',
  cleanup:           'Artifact teardown, session cleanup',
}

/* ════════════════════════════════════════════════════════════════════════════
   Attack paths
   ════════════════════════════════════════════════════════════════════════════ */

export const ATTACK_PATH_LABEL: Record<AttackPath, string> = {
  cve_exploit:  'CVE Exploit',
  brute_force:  'Brute Force',
  unclassified: 'Web App',
}

export const ATTACK_PATH_DESCRIPTION: Record<AttackPath, string> = {
  cve_exploit:  'Known CVE with available exploit — Metasploit-first workflow',
  brute_force:  'Credential attack against exposed services (SSH, RDP, SMB, HTTP)',
  unclassified: 'Web application attacks (SQLi, XSS, SSRF, file upload, IDOR)',
}

/* ════════════════════════════════════════════════════════════════════════════
   Brand
   ════════════════════════════════════════════════════════════════════════════ */

export const BRAND = {
  name: 'pentagron',
  tagline: 'Autonomous Penetration Testing',
  /** Index of the letter in `name` to highlight with the green accent dot. */
  accentLetterIndex: 4, // the 'a' in pent[a]gron
} as const
