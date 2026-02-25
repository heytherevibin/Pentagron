package database

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ── Core entities ─────────────────────────────────────────────────────────────

type User struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email     string         `gorm:"uniqueIndex;not null" json:"email"`
	Password  string         `gorm:"not null" json:"-"`
	Role      string         `gorm:"default:operator" json:"role"` // admin | operator | viewer
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Projects  []Project      `gorm:"foreignKey:OwnerID" json:"projects,omitempty"`
}

type Project struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	OwnerID     uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	Scope       string         `gorm:"type:text" json:"scope"`       // CIDR / domains JSON
	Settings    string         `gorm:"type:jsonb;default:'{}'" json:"settings"` // 180+ params
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Owner       *User          `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Flows       []Flow         `gorm:"foreignKey:ProjectID" json:"flows,omitempty"`
}

// ── Flow hierarchy: Flow → Task → SubTask → Action → Artifact ────────────────

type FlowStatus string

const (
	FlowStatusPending    FlowStatus = "pending"
	FlowStatusRunning    FlowStatus = "running"
	FlowStatusPaused     FlowStatus = "paused"     // awaiting approval
	FlowStatusCompleted  FlowStatus = "completed"
	FlowStatusFailed     FlowStatus = "failed"
	FlowStatusCancelled  FlowStatus = "cancelled"
)

type Flow struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	Name        string         `gorm:"not null" json:"name"`
	Objective   string         `gorm:"type:text" json:"objective"`
	Status      FlowStatus     `gorm:"default:pending" json:"status"`
	Phase       string         `gorm:"default:recon" json:"phase"` // recon|analysis|exploitation|post-exploit|report
	AttackPath  string         `json:"attack_path"` // cve_exploit | brute_force | unclassified
	StartedAt   *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Project     *Project       `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	Tasks       []Task         `gorm:"foreignKey:FlowID" json:"tasks,omitempty"`
	Sessions    []Session      `gorm:"foreignKey:FlowID" json:"sessions,omitempty"`
}

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusSkipped   TaskStatus = "skipped"
)

type Task struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FlowID      uuid.UUID      `gorm:"type:uuid;not null" json:"flow_id"`
	ParentID    *uuid.UUID     `gorm:"type:uuid" json:"parent_id,omitempty"`
	AgentType   string         `gorm:"not null" json:"agent_type"` // pentester|coder|recon|reporter|orchestrator
	Title       string         `gorm:"not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Status      TaskStatus     `gorm:"default:pending" json:"status"`
	Priority    int            `gorm:"default:0" json:"priority"`
	Result      string         `gorm:"type:text" json:"result"`
	ErrorMsg    string         `gorm:"type:text" json:"error_msg"`
	StartedAt   *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Flow        *Flow          `gorm:"foreignKey:FlowID" json:"flow,omitempty"`
	Parent      *Task          `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	SubTasks    []Task         `gorm:"foreignKey:ParentID" json:"sub_tasks,omitempty"`
	Actions     []Action       `gorm:"foreignKey:TaskID" json:"actions,omitempty"`
}

type Action struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TaskID      uuid.UUID  `gorm:"type:uuid;not null" json:"task_id"`
	Type        string     `gorm:"not null" json:"type"` // tool_call | llm_call | approval_request
	ToolName    string     `json:"tool_name"`
	Input       string     `gorm:"type:jsonb" json:"input"`
	Output      string     `gorm:"type:text" json:"output"`
	Duration    int64      `json:"duration_ms"`
	Success     bool       `json:"success"`
	CreatedAt   time.Time  `json:"created_at"`
	Task        *Task      `gorm:"foreignKey:TaskID" json:"task,omitempty"`
	Artifacts   []Artifact `gorm:"foreignKey:ActionID" json:"artifacts,omitempty"`
}

type Artifact struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ActionID  uuid.UUID `gorm:"type:uuid;not null" json:"action_id"`
	Type      string    `json:"type"` // credential | vulnerability | host | service | exploit
	Name      string    `json:"name"`
	Value     string    `gorm:"type:text" json:"value"`
	Severity  string    `json:"severity"` // critical | high | medium | low | info
	Metadata  string    `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
	Action    *Action   `gorm:"foreignKey:ActionID" json:"action,omitempty"`
}

// ── Session (tracks a single agent run within a flow) ─────────────────────────

type Session struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FlowID      uuid.UUID  `gorm:"type:uuid;not null" json:"flow_id"`
	UserID      *uuid.UUID `gorm:"type:uuid" json:"user_id,omitempty"`
	Status      string     `gorm:"default:active" json:"status"`
	Neo4jChain  string     `json:"neo4j_chain_id"` // AttackChain node ID in Neo4j
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Flow        *Flow      `gorm:"foreignKey:FlowID" json:"flow,omitempty"`
}

// ── Vector memory records ─────────────────────────────────────────────────────

type MemoryRecord struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	StoreType string    `gorm:"not null" json:"store_type"` // guide | task | research | result
	Content   string    `gorm:"type:text;not null" json:"content"`
	Embedding string    `gorm:"type:vector(1536)" json:"-"` // pgvector
	Metadata  string    `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
}

// ── Settings ──────────────────────────────────────────────────────────────

type Setting struct {
	Key       string    `gorm:"primaryKey;not null"`
	Value     string    `gorm:"type:text"`
	UpdatedAt time.Time
}

// ── Worker nodes ─────────────────────────────────────────────────────────────

// WorkerStatus represents the current liveness state of a worker node.
type WorkerStatus string

const (
	WorkerStatusOnline  WorkerStatus = "online"
	WorkerStatusOffline WorkerStatus = "offline"
	WorkerStatusBusy    WorkerStatus = "busy"
)

// WorkerNode is a remote execution agent that polls for tasks and returns results.
// Used in air-gapped deployments where the main server cannot reach target networks.
type WorkerNode struct {
	ID           string       `gorm:"primaryKey;not null" json:"id"`
	Hostname     string       `gorm:"not null" json:"hostname"`
	Capabilities string       `gorm:"type:jsonb;default:'[]'" json:"capabilities"` // ["naabu","nuclei",...]
	Status       WorkerStatus `gorm:"default:online" json:"status"`
	LastSeenAt   time.Time    `json:"last_seen_at"`
	RegisteredAt time.Time    `json:"registered_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
}

// WorkerTaskStatus represents the lifecycle of a task assigned to a worker.
type WorkerTaskStatus string

const (
	WorkerTaskPending   WorkerTaskStatus = "pending"
	WorkerTaskDispatched WorkerTaskStatus = "dispatched"
	WorkerTaskCompleted WorkerTaskStatus = "completed"
	WorkerTaskFailed    WorkerTaskStatus = "failed"
)

// WorkerTask is a tool-execution unit queued for a specific worker node.
type WorkerTask struct {
	ID         uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkerID   string           `gorm:"not null;index" json:"worker_id"`
	ToolName   string           `gorm:"not null" json:"tool_name"`
	Input      string           `gorm:"type:jsonb" json:"input"`
	Output     string           `gorm:"type:text" json:"output"`
	Status     WorkerTaskStatus `gorm:"default:pending" json:"status"`
	Error      string           `gorm:"type:text" json:"error"`
	CreatedAt  time.Time        `json:"created_at"`
	UpdatedAt  time.Time        `json:"updated_at"`
	Worker     *WorkerNode      `gorm:"foreignKey:WorkerID;references:ID" json:"worker,omitempty"`
}

// ── Approval requests ─────────────────────────────────────────────────────────

type ApprovalStatus string

const (
	ApprovalStatusPending  ApprovalStatus = "pending"
	ApprovalStatusApproved ApprovalStatus = "approved"
	ApprovalStatusRejected ApprovalStatus = "rejected"
)

type ApprovalRequest struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FlowID      uuid.UUID      `gorm:"type:uuid;not null" json:"flow_id"`
	Phase       string         `json:"phase"`
	Description string         `gorm:"type:text" json:"description"`
	Payload     string         `gorm:"type:jsonb" json:"payload"` // what the agent wants to do
	Status      ApprovalStatus `gorm:"default:pending" json:"status"`
	ReviewedBy  *uuid.UUID     `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt  *time.Time     `json:"reviewed_at,omitempty"`
	Notes       string         `gorm:"type:text" json:"notes"`
	CreatedAt   time.Time      `json:"created_at"`
	Flow        *Flow          `gorm:"foreignKey:FlowID" json:"flow,omitempty"`
}
