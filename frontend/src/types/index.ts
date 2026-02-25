// ── Core domain types ─────────────────────────────────────────────────────────

export type FlowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type Phase = 'recon' | 'analysis' | 'exploitation' | 'post_exploitation' | 'report'
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
