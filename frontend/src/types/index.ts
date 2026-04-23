// ── Core domain types ─────────────────────────────────────────────────────────

export type FlowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type Phase = 'recon' | 'analysis' | 'exploitation' | 'post_exploitation' | 'reporting' | 'cleanup'
export type AttackPath = 'cve_exploit' | 'brute_force' | 'unclassified'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface User {
  id: string
  email: string
  role: 'admin' | 'operator' | 'viewer'
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  owner_id: string
  scope: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Flow {
  id: string
  project_id: string
  name: string
  objective: string
  status: FlowStatus
  phase: Phase
  attack_path: AttackPath
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  flow_id: string
  parent_id?: string
  agent_type: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  result?: string
  created_at: string
}

export interface Action {
  id: string
  task_id: string
  type: 'tool_call' | 'llm_call' | 'approval_request'
  tool_name?: string
  input?: string
  output?: string
  duration_ms: number
  success: boolean
  created_at: string
}

export interface Artifact {
  id: string
  action_id: string
  type: 'credential' | 'vulnerability' | 'host' | 'service' | 'exploit'
  name: string
  value: string
  severity: Severity
  metadata: Record<string, unknown>
  created_at: string
}

export interface ApprovalRequest {
  id: string
  flow_id: string
  phase: Phase
  description: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

// ── WebSocket message types ───────────────────────────────────────────────────

export type WSMessageType =
  | 'agent_thought'
  | 'tool_call'
  | 'tool_result'
  | 'phase_change'
  | 'approval_request'
  | 'user_guidance'
  | 'final_answer'
  | 'error'
  | 'ping'

export interface WSMessage {
  type: WSMessageType
  session_id: string
  flow_id: string
  payload: unknown
  timestamp: string
  // Flattened fields commonly sent by the backend
  content?: string
  iteration?: number
  toolName?: string
  toolInput?: unknown
  success?: boolean
}

// ── LLM / model types ─────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string
  name: string
  provider: string
  context_size?: number
}

// ── Graph visualization types ─────────────────────────────────────────────────

export interface GraphNode {
  id: string
  label: string
  type: string  // AttackChain | ChainStep | ChainFinding | Domain | Host | Service | Vulnerability | ...
  properties: Record<string, unknown>
  x?: number
  y?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationKind =
  | 'approval_request'
  | 'flow_completed'
  | 'flow_failed'
  | 'finding_critical'
  | 'finding_high'
  | 'system'
  | 'mention'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  href?: string
  flow_id?: string
  project_id?: string
  read_at?: string
  created_at: string
}

// ── Insights / Metrics ────────────────────────────────────────────────────────

export interface MetricSummary {
  total_flows: number
  running_flows: number
  completed_flows: number
  failed_flows: number
  total_findings: number
  critical_findings: number
  high_findings: number
  medium_findings: number
  low_findings: number
  mean_time_to_finding_seconds?: number
  approvals_pending: number
  approvals_resolved_24h: number
}

export interface TimeseriesPoint {
  bucket: string // ISO timestamp
  value: number
  [k: string]: number | string
}

export interface SeverityTimeseries {
  points: Array<{
    bucket: string
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }>
}

export interface PhaseDurationBucket {
  phase: Phase
  p50_seconds: number
  p90_seconds: number
  p99_seconds: number
  mean_seconds: number
  samples: number
}

export interface TopTarget {
  target: string
  flow_count: number
  finding_count: number
  last_seen: string
}

// ── Flow runs (history) ───────────────────────────────────────────────────────

export interface FlowRun {
  id: string
  flow_id: string
  status: FlowStatus
  phase: Phase
  started_at: string
  completed_at?: string
  duration_ms?: number
  findings_count: number
  critical_count: number
  trigger: 'manual' | 'schedule' | 'api' | 'retry'
  triggered_by?: string
}

// ── Audit / Security ──────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string
  actor_id: string
  actor_email: string
  action: string
  target_type: string
  target_id?: string
  ip?: string
  user_agent?: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  scopes: string[]
  created_at: string
  last_used_at?: string
  expires_at?: string
  revoked_at?: string
}

export interface Session {
  id: string
  user_id: string
  ip: string
  user_agent: string
  city?: string
  country?: string
  current: boolean
  created_at: string
  last_active_at: string
  expires_at: string
}

export interface Integration {
  id: string
  kind: 'slack' | 'jira' | 'webhook' | 'email' | 'pagerduty'
  name: string
  enabled: boolean
  config: Record<string, unknown>
  created_at: string
  last_delivery_at?: string
  last_error?: string
}

export interface RbacRole {
  id: string
  name: 'admin' | 'operator' | 'viewer' | string
  description?: string
  permissions: string[]
  system: boolean
}

export interface RbacPermission {
  key: string
  group: string
  description: string
}

// ── 2FA / SSO ─────────────────────────────────────────────────────────────────

export interface TwoFactorStatus {
  enabled: boolean
  method?: 'totp' | 'webauthn'
  enrolled_at?: string
  last_used_at?: string
}

export interface SsoProvider {
  id: string
  kind: 'saml' | 'oidc'
  name: string
  enabled: boolean
  issuer?: string
  acs_url?: string
  created_at: string
}
