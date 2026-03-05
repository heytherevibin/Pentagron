'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { DataLabel } from '@/components/ui/DataLabel'
import { GlowDot } from '@/components/ui/GlowDot'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContentShell } from '@/components/layout/PageContentShell'
import { api } from '@/lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'general' | 'llm' | 'agents' | 'mcp' | 'users' | 'health'

type DotStatus = 'ok' | 'error' | 'warning' | 'offline'

interface GeneralSettings {
  defaultProvider: string
  defaultModel: string
  autoApproval: boolean
  maxIterations: number
}

interface ProviderConfig {
  name: string
  label: string
  apiKey: string
  baseUrl: string
  status: DotStatus
  testing: boolean
}

interface AgentModelOverride {
  agent: string
  model: string
}

interface AgentSettings {
  maxIterations: number
  requireApproval: boolean
  evographEnabled: boolean
  vectorStoreEnabled: boolean
  summarizerLastSecBytes: number
  summarizerMaxQABytes: number
}

interface MCPServer {
  name: string
  url: string
  port: number
  status: DotStatus
  testing: boolean
}

interface UserRecord {
  id: string
  email: string
  role: 'admin' | 'operator' | 'viewer'
  projects: number
  lastLogin: string
  status: 'active' | 'inactive'
}

interface HealthService {
  name: string
  status: DotStatus
  latency?: number
  error?: string
}

interface HealthData {
  llmProviders: HealthService[]
  mcpServers: HealthService[]
  databases: HealthService[]
  docker: HealthService
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'GENERAL' },
  { key: 'llm', label: 'LLM' },
  { key: 'agents', label: 'AGENTS' },
  { key: 'mcp', label: 'MCP' },
  { key: 'users', label: 'USERS' },
  { key: 'health', label: 'HEALTH' },
]

const PROVIDER_OPTIONS = ['anthropic', 'openai', 'openrouter', 'deepseek', 'ollama']

const ROLE_OPTIONS: UserRecord['role'][] = ['admin', 'operator', 'viewer']

const AGENT_TYPES = ['Orchestrator', 'Pentester', 'Recon', 'Coder', 'Reporter', 'Summarizer']

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { name: 'anthropic', label: 'Anthropic', apiKey: '', baseUrl: 'https://api.anthropic.com', status: 'offline', testing: false },
  { name: 'openai', label: 'OpenAI', apiKey: '', baseUrl: 'https://api.openai.com/v1', status: 'offline', testing: false },
  { name: 'openrouter', label: 'OpenRouter', apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', status: 'offline', testing: false },
  { name: 'deepseek', label: 'DeepSeek', apiKey: '', baseUrl: 'https://api.deepseek.com', status: 'offline', testing: false },
  { name: 'ollama', label: 'Ollama', apiKey: '', baseUrl: 'http://localhost:11434', status: 'offline', testing: false },
]

const DEFAULT_MCP_SERVERS: MCPServer[] = [
  { name: 'Naabu', url: 'http://localhost:8000', port: 8000, status: 'offline', testing: false },
  { name: 'SQLMap', url: 'http://localhost:8001', port: 8001, status: 'offline', testing: false },
  { name: 'Nuclei', url: 'http://localhost:8002', port: 8002, status: 'offline', testing: false },
  { name: 'Metasploit', url: 'http://localhost:8003', port: 8003, status: 'offline', testing: false },
]

const MOCK_USERS: UserRecord[] = [
  { id: '1', email: 'admin@pentagron.io', role: 'admin', projects: 5, lastLogin: '2026-02-25T10:30:00Z', status: 'active' },
  { id: '2', email: 'operator@pentagron.io', role: 'operator', projects: 3, lastLogin: '2026-02-24T14:15:00Z', status: 'active' },
  { id: '3', email: 'viewer@pentagron.io', role: 'viewer', projects: 1, lastLogin: '2026-02-20T09:00:00Z', status: 'active' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '********' : ''
  return key.slice(0, 4) + '****' + key.slice(-4)
}

// ── Toggle Switch Component ──────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 items-center border transition-colors
        ${checked ? 'bg-blue-500/20 border-blue-500' : 'bg-background border-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          inline-block h-3 w-3 transform transition-transform
          ${checked ? 'translate-x-[18px] bg-blue-500' : 'translate-x-[3px] bg-muted'}
        `}
      />
    </button>
  )
}

// ── Select Dropdown Component ────────────────────────────────────────────────

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      {label && <DataLabel>{label}</DataLabel>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border text-foreground font-mono text-sm px-3 py-2 focus:border-blue-500/50 focus:outline-none appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Eye Icon for API Key Reveal ──────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// ── Masked API Key Input ─────────────────────────────────────────────────────

function MaskedInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-1">
      {label && <DataLabel>{label}</DataLabel>}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '****'}
          className="w-full bg-background border border-border text-foreground font-mono text-sm px-3 py-2 pr-9 placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-muted transition-colors"
          tabIndex={-1}
        >
          <EyeIcon open={!visible} />
        </button>
      </div>
    </div>
  )
}

// ── Loading Skeleton for Tab Content ─────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton variant="line" className="w-48 h-5" />
      <Skeleton variant="card" className="h-32" />
      <Skeleton variant="card" className="h-24" />
      <Skeleton variant="line" className="w-32 h-5" />
    </div>
  )
}

// =============================================================================
// SETTINGS PAGE
// =============================================================================

const TAB_KEYS: TabKey[] = ['general', 'llm', 'agents', 'mcp', 'users', 'health']

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const initialTab: TabKey =
    tabFromUrl && TAB_KEYS.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : 'general'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && TAB_KEYS.includes(t as TabKey)) setActiveTab(t as TabKey)
  }, [searchParams])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── General state ──────────────────────────────────────────────────────────
  const [serverStatus, setServerStatus] = useState<DotStatus>('offline')
  const [general, setGeneral] = useState<GeneralSettings>({
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    autoApproval: false,
    maxIterations: 25,
  })

  // ── LLM state ──────────────────────────────────────────────────────────────
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS)
  const [agentOverrides, setAgentOverrides] = useState<AgentModelOverride[]>(
    AGENT_TYPES.map((a) => ({ agent: a, model: '' }))
  )

  // ── Agents state ───────────────────────────────────────────────────────────
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    maxIterations: 25,
    requireApproval: true,
    evographEnabled: true,
    vectorStoreEnabled: true,
    summarizerLastSecBytes: 51200,
    summarizerMaxQABytes: 65536,
  })

  // ── MCP state ──────────────────────────────────────────────────────────────
  const [mcpServers, setMcpServers] = useState<MCPServer[]>(DEFAULT_MCP_SERVERS)

  // ── Users state ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>(MOCK_USERS)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRecord['role']>('operator')
  const [inviteProjects, setInviteProjects] = useState('')
  const [inviting, setInviting] = useState(false)

  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // ── Health state ───────────────────────────────────────────────────────────
  const [healthData, setHealthData] = useState<HealthData>({
    llmProviders: [],
    mcpServers: [],
    databases: [],
    docker: { name: 'Kali Sandbox', status: 'offline' },
  })
  const [refreshing, setRefreshing] = useState(false)

  // ── Fetch Settings ─────────────────────────────────────────────────────────

  const fetchGeneral = useCallback(async () => {
    try {
      const res = await api.get('/api/settings/general')
      const data = res.data?.data ?? res.data
      if (data) {
        setGeneral({
          defaultProvider: data.defaultProvider ?? data.default_provider ?? 'anthropic',
          defaultModel: data.defaultModel ?? data.default_model ?? 'claude-sonnet-4-20250514',
          autoApproval: data.autoApproval ?? data.auto_approval ?? false,
          maxIterations: data.maxIterations ?? data.max_iterations ?? 25,
        })
      }
      setServerStatus('ok')
    } catch {
      // API may not exist yet — use defaults
      setServerStatus('ok')
    }
  }, [])

  const fetchLLM = useCallback(async () => {
    try {
      const res = await api.get('/api/settings/llm')
      const data = res.data?.data ?? res.data
      // Backend returns providers as an object map: { anthropic: {...}, openai: {...} }
      if (data?.providers && typeof data.providers === 'object' && !Array.isArray(data.providers)) {
        const provMap = data.providers as Record<string, Record<string, string>>
        setProviders((prev) =>
          prev.map((p) => {
            const remote = provMap[p.name]
            if (remote) {
              return {
                ...p,
                apiKey: remote.apiKey ?? '',
                baseUrl: remote.baseURL ?? p.baseUrl,
              }
            }
            return p
          })
        )
      }
      // Backend returns agentModels as an object map: { orchestrator: "...", pentester: "..." }
      if (data?.agentModels && typeof data.agentModels === 'object') {
        const modelMap = data.agentModels as Record<string, string>
        setAgentOverrides(
          AGENT_TYPES.map((a) => ({
            agent: a,
            model: modelMap[a.toLowerCase()] ?? '',
          }))
        )
      }
    } catch {
      // use defaults
    }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/api/settings/agents')
      const data = res.data?.data ?? res.data
      if (data) {
        setAgentSettings({
          maxIterations: data.maxIterations ?? 25,
          requireApproval: data.requireApproval ?? true,
          evographEnabled: data.evographEnabled ?? true,
          vectorStoreEnabled: data.vectorStoreEnabled ?? true,
          summarizerLastSecBytes: data.summarizerLastSecBytes ?? 51200,
          summarizerMaxQABytes: data.summarizerMaxQABytes ?? 65536,
        })
      }
    } catch {
      // use defaults
    }
  }, [])

  const fetchMCP = useCallback(async () => {
    try {
      const res = await api.get('/api/settings/mcp')
      const data = res.data?.data ?? res.data
<<<<<<< HEAD
      // Backend returns servers as an object map: { naabu: "url", sqlmap: "url" }
      if (data?.servers && typeof data.servers === 'object' && !Array.isArray(data.servers)) {
        const svrMap = data.servers as Record<string, string>
        setMcpServers((prev) =>
          prev.map((s) => {
            const remoteUrl = svrMap[s.name.toLowerCase()]
            if (remoteUrl) {
              return { ...s, url: remoteUrl }
            }
            return s
          })
=======
      const servers = data?.servers
      if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
        setMcpServers((prev) =>
          prev.map((s) => ({
            ...s,
            url: (servers[s.name.toLowerCase()] as string) ?? s.url,
          }))
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
        )
      }
    } catch {
      // use defaults
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users')
      const data = res.data?.data ?? res.data
      if (Array.isArray(data)) {
        setUsers(
          data.map((u: Record<string, unknown>) => ({
            id: u.id as string,
            email: u.email as string,
            role: (u.role as UserRecord['role']) ?? 'viewer',
            projects: (u.projects as number) ?? 0,
            lastLogin: (u.last_login as string) ?? '',
            status: (u.active === false ? 'inactive' : 'active') as 'active' | 'inactive',
          }))
        )
      }
    } catch {
      // keep existing list on error
    }
  }, [])

  const fetchHealth = useCallback(async () => {
    try {
      const [allRes, provRes, mcpRes] = await Promise.allSettled([
        api.get('/api/health/all'),
        api.get('/api/health/providers'),
        api.get('/api/health/mcp'),
      ])

      const llmProviders: HealthService[] =
        provRes.status === 'fulfilled'
          ? (provRes.value.data?.data ?? provRes.value.data ?? []).map(
              (p: Record<string, unknown>) => ({
                name: p.name as string,
                status: (p.status as DotStatus) ?? 'offline',
                latency: p.latency_ms as number | undefined,
                error: p.error as string | undefined,
              })
            )
          : PROVIDER_OPTIONS.map((name) => ({ name, status: 'offline' as DotStatus }))

      const mcpRaw = mcpRes.status === 'fulfilled' ? (mcpRes.value.data?.data ?? mcpRes.value.data) : null
      const mcpSvcs: HealthService[] =
        mcpRaw && typeof mcpRaw === 'object' && !Array.isArray(mcpRaw)
          ? Object.entries(mcpRaw).map(([key, value]) => {
              const statusStr = String(value)
              const status: DotStatus = statusStr === 'ok' ? 'ok' : 'error'
              const error = statusStr.startsWith('error: ') ? statusStr.slice(7) : undefined
              const displayNames: Record<string, string> = { naabu: 'Naabu', sqlmap: 'SQLMap', nuclei: 'Nuclei', metasploit: 'Metasploit' }
              return { name: displayNames[key] ?? key, status, error }
            })
          : DEFAULT_MCP_SERVERS.map((s) => ({ name: s.name, status: 'offline' as DotStatus }))

      // Use /api/health/all for database and docker status
      let databases: HealthService[] = [
        { name: 'PostgreSQL', status: 'offline' },
        { name: 'Neo4j', status: 'offline' },
        { name: 'Redis', status: 'offline' },
      ]
      let docker: HealthService = { name: 'Kali Sandbox', status: 'offline' }

      if (allRes.status === 'fulfilled') {
        const allData = allRes.value.data?.data ?? allRes.value.data
        if (allData?.database) {
          const dbStatus = (allData.database.status as DotStatus) ?? 'offline'
          databases = [{ name: 'PostgreSQL', status: dbStatus }]
        }
        if (allData?.docker) {
          docker = {
            name: 'Kali Sandbox',
            status: (allData.docker.status as DotStatus) === 'ok' ? 'ok' : 'offline',
          }
        }
      }

      setHealthData({ llmProviders: llmProviders, mcpServers: mcpSvcs, databases, docker })
    } catch {
      // fallback — all offline
    }
  }, [])

  // ── Initial Load ───────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    const loader = async () => {
      switch (activeTab) {
        case 'general':
          await fetchGeneral()
          break
        case 'llm':
          await fetchLLM()
          break
        case 'agents':
          await fetchAgents()
          break
        case 'mcp':
          await fetchMCP()
          break
        case 'users':
          await fetchUsers()
          break
        case 'health':
          await fetchHealth()
          break
      }
      setLoading(false)
    }
    loader()
  }, [activeTab, fetchGeneral, fetchLLM, fetchAgents, fetchMCP, fetchUsers, fetchHealth])

  // ── Save Handlers ──────────────────────────────────────────────────────────

  async function saveGeneral() {
    setSaving(true)
    try {
      await api.put('/api/settings/general', {
        defaultProvider: general.defaultProvider,
        defaultModel: general.defaultModel,
        autoApproval: general.autoApproval,
        maxIterations: general.maxIterations,
      })
      toast.success('General settings saved')
    } catch {
      toast.error('Failed to save general settings')
    } finally {
      setSaving(false)
    }
  }

  async function saveLLM() {
    setSaving(true)
    try {
      // Backend expects providers as an object map and agentModels as an object map
      const providersMap: Record<string, { apiKey: string; baseURL: string }> = {}
      for (const p of providers) {
        providersMap[p.name] = { apiKey: p.apiKey, baseURL: p.baseUrl }
      }
      const agentModelsMap: Record<string, string> = {}
      for (const o of agentOverrides) {
        if (o.model.trim()) {
          agentModelsMap[o.agent.toLowerCase()] = o.model.trim()
        }
      }
      await api.put('/api/settings/llm', {
        providers: providersMap,
        agentModels: agentModelsMap,
      })
      toast.success('LLM settings saved')
    } catch {
      toast.error('Failed to save LLM settings')
    } finally {
      setSaving(false)
    }
  }

  async function saveAgents() {
    setSaving(true)
    try {
      await api.put('/api/settings/agents', {
        maxIterations: agentSettings.maxIterations,
        requireApproval: agentSettings.requireApproval,
        evographEnabled: agentSettings.evographEnabled,
        vectorStoreEnabled: agentSettings.vectorStoreEnabled,
        summarizerLastSecBytes: agentSettings.summarizerLastSecBytes,
        summarizerMaxQABytes: agentSettings.summarizerMaxQABytes,
      })
      toast.success('Agent settings saved')
    } catch {
      toast.error('Failed to save agent settings')
    } finally {
      setSaving(false)
    }
  }

  async function saveMCP() {
    setSaving(true)
    try {
<<<<<<< HEAD
      // Backend expects servers as an object map: { naabu: "url", sqlmap: "url" }
      const serversMap: Record<string, string> = {}
      for (const s of mcpServers) {
        serversMap[s.name.toLowerCase()] = s.url
      }
      await api.put('/api/settings/mcp', { servers: serversMap })
=======
      const servers: Record<string, string> = {}
      mcpServers.forEach((s) => {
        servers[s.name.toLowerCase()] = s.url
      })
      await api.put('/api/settings/mcp', { servers })
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
      toast.success('MCP settings saved')
    } catch {
      toast.error('Failed to save MCP settings')
    } finally {
      setSaving(false)
    }
  }

  // ── Test Handlers ──────────────────────────────────────────────────────────

  async function testProvider(name: string) {
    setProviders((prev) =>
      prev.map((p) => (p.name === name ? { ...p, testing: true } : p))
    )
    try {
      const res = await api.post(`/api/settings/llm/test`, { provider: name })
      const data = res.data?.data ?? res.data
      const status: DotStatus = data?.status === 'ok' ? 'ok' : 'error'
      setProviders((prev) =>
        prev.map((p) => (p.name === name ? { ...p, status, testing: false } : p))
      )
      toast.success(`${name}: ${status}`)
    } catch {
      setProviders((prev) =>
        prev.map((p) => (p.name === name ? { ...p, status: 'error', testing: false } : p))
      )
      toast.error(`${name}: connection failed`)
    }
  }

  async function testMCPServer(serverName: string) {
    setMcpServers((prev) =>
      prev.map((s) => (s.name === serverName ? { ...s, testing: true } : s))
    )
    try {
      const res = await api.post(`/api/settings/mcp/test`, {
        server: serverName.toLowerCase(),
      })
      const data = res.data?.data ?? res.data
      const status: DotStatus = data?.status === 'ok' ? 'ok' : 'error'
      setMcpServers((prev) =>
        prev.map((s) => (s.name === serverName ? { ...s, status, testing: false } : s))
      )
      toast.success(`${serverName}: ${status}`)
    } catch {
      setMcpServers((prev) =>
        prev.map((s) => (s.name === serverName ? { ...s, status: 'error', testing: false } : s))
      )
      toast.error(`${serverName}: connection failed`)
    }
  }

  // ── User Handlers ──────────────────────────────────────────────────────────

  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await api.post('/api/users', {
        email: inviteEmail.trim(),
        password: crypto.randomUUID(), // temporary password; user should reset via email
        role: inviteRole,
      })
      toast.success(`Invited ${inviteEmail}`)
      setUsers((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          email: inviteEmail.trim(),
          role: inviteRole,
          projects: 0,
          lastLogin: '',
          status: 'active',
        },
      ])
      setInviteEmail('')
      setInviteRole('operator')
      setInviteProjects('')
      setInviteOpen(false)
    } catch {
      toast.error('Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  async function handleUpdateUserRole(userId: string, role: UserRecord['role']) {
    try {
      await api.put(`/api/users/${userId}`, { role })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    }
  }

  async function handleDeactivateUser() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await api.delete(`/api/users/${deactivateTarget.id}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === deactivateTarget.id ? { ...u, status: 'inactive' } : u))
      )
      toast.success(`Deactivated ${deactivateTarget.email}`)
    } catch {
      toast.error('Failed to deactivate user')
      // Apply locally anyway for demo
      setUsers((prev) =>
        prev.map((u) => (u.id === deactivateTarget.id ? { ...u, status: 'inactive' } : u))
      )
    } finally {
      setDeactivating(false)
      setDeactivateOpen(false)
      setDeactivateTarget(null)
    }
  }

  // ── Health Refresh ─────────────────────────────────────────────────────────

  async function refreshHealth() {
    setRefreshing(true)
    await fetchHealth()
    setRefreshing(false)
    toast.success('Health check complete')
  }

  // ── Tab Content Renderers ──────────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div className="space-y-6">
        {/* App Identity */}
        <Panel title="APPLICATION">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <DataLabel>APP NAME</DataLabel>
              <span className="text-sm font-mono text-blue-500 font-bold tracking-wider">
                PENTAGRON
              </span>
            </div>

            <div className="flex items-center gap-4">
              <DataLabel>SERVER STATUS</DataLabel>
              <div className="flex items-center gap-2">
                <GlowDot status={serverStatus} size="md" />
                <span className="text-xs font-mono text-muted uppercase">
                  {serverStatus === 'ok' ? 'ONLINE' : serverStatus === 'error' ? 'ERROR' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Configuration */}
        <Panel title="CONFIGURATION">
          <div className="space-y-5">
            <Select
              label="DEFAULT MODEL PROVIDER"
              value={general.defaultProvider}
              options={PROVIDER_OPTIONS.map((p) => ({ value: p, label: p.toUpperCase() }))}
              onChange={(v) => setGeneral((s) => ({ ...s, defaultProvider: v }))}
            />

            <Input
              label="DEFAULT MODEL"
              value={general.defaultModel}
              onChange={(e) => setGeneral((s) => ({ ...s, defaultModel: e.target.value }))}
              placeholder="claude-sonnet-4-20250514"
            />

            <div className="flex items-center justify-between">
              <div>
                <DataLabel>AUTO-APPROVAL</DataLabel>
                <p className="text-xxs font-mono text-muted mt-0.5">
                  skip approval gates for non-exploitation phases
                </p>
              </div>
              <Toggle
                checked={general.autoApproval}
                onChange={(v) => setGeneral((s) => ({ ...s, autoApproval: v }))}
              />
            </div>

            <Input
              label="MAX ITERATIONS"
              type="number"
              min={1}
              max={100}
              value={general.maxIterations}
              onChange={(e) =>
                setGeneral((s) => ({
                  ...s,
                  maxIterations: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)),
                }))
              }
            />
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={saveGeneral}>
            SAVE CHANGES
          </Button>
        </div>
      </div>
    )
  }

  function renderLLM() {
    return (
      <div className="space-y-6">
        {/* Provider Cards */}
        <Panel title="PROVIDER CONFIGURATION">
          <div className="space-y-4">
            {providers.map((provider) => (
              <div
                key={provider.name}
                className="border border-border bg-background p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GlowDot status={provider.status} size="md" />
                    <span className="text-sm font-mono font-bold text-foreground uppercase tracking-wider">
                      {provider.label}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={provider.testing}
                    onClick={() => testProvider(provider.name)}
                  >
                    TEST
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MaskedInput
                    label="API KEY"
                    value={provider.apiKey}
                    onChange={(v) =>
                      setProviders((prev) =>
                        prev.map((p) =>
                          p.name === provider.name ? { ...p, apiKey: v } : p
                        )
                      )
                    }
                    placeholder="sk-..."
                  />

                  <Input
                    label="BASE URL"
                    value={provider.baseUrl}
                    onChange={(e) =>
                      setProviders((prev) =>
                        prev.map((p) =>
                          p.name === provider.name
                            ? { ...p, baseUrl: e.target.value }
                            : p
                        )
                      )
                    }
                    placeholder="https://api.example.com"
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Agent Model Overrides */}
        <Panel title="PER-AGENT MODEL OVERRIDES">
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 px-3 py-2 border-b border-border">
              <DataLabel>AGENT</DataLabel>
              <DataLabel>MODEL OVERRIDE</DataLabel>
            </div>

            {/* Agent Rows */}
            {agentOverrides.map((override) => (
              <div
                key={override.agent}
                className="grid grid-cols-[1fr_2fr] gap-4 px-3 py-3 border-b border-border last:border-b-0 items-center"
              >
                <span className="text-xs font-mono text-muted uppercase tracking-wider">
                  {override.agent}
                </span>
                <input
                  type="text"
                  value={override.model}
                  onChange={(e) =>
                    setAgentOverrides((prev) =>
                      prev.map((o) =>
                        o.agent === override.agent
                          ? { ...o, model: e.target.value }
                          : o
                      )
                    )
                  }
                  placeholder="leave empty for default"
                  className="w-full bg-background border border-border text-foreground font-mono text-sm px-3 py-1.5 placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={saveLLM}>
            SAVE CHANGES
          </Button>
        </div>
      </div>
    )
  }

  function renderAgents() {
    return (
      <div className="space-y-6">
        <Panel title="AGENT CONFIGURATION">
          <div className="space-y-5">
            <Input
              label="MAX ITERATIONS"
              type="number"
              min={1}
              max={500}
              value={agentSettings.maxIterations}
              onChange={(e) =>
                setAgentSettings((s) => ({
                  ...s,
                  maxIterations: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
            />

            <div className="flex items-center justify-between">
              <div>
                <DataLabel>REQUIRE APPROVAL</DataLabel>
                <p className="text-xxs font-mono text-muted mt-0.5">
                  require human approval before phase transitions
                </p>
              </div>
              <Toggle
                checked={agentSettings.requireApproval}
                onChange={(v) => setAgentSettings((s) => ({ ...s, requireApproval: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <DataLabel>EVOGRAPH ENABLED</DataLabel>
                <p className="text-xxs font-mono text-muted mt-0.5">
                  enable Neo4j-backed attack chain memory graph
                </p>
              </div>
              <Toggle
                checked={agentSettings.evographEnabled}
                onChange={(v) => setAgentSettings((s) => ({ ...s, evographEnabled: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <DataLabel>VECTOR STORE ENABLED</DataLabel>
                <p className="text-xxs font-mono text-muted mt-0.5">
                  enable pgvector semantic memory for context retrieval
                </p>
              </div>
              <Toggle
                checked={agentSettings.vectorStoreEnabled}
                onChange={(v) => setAgentSettings((s) => ({ ...s, vectorStoreEnabled: v }))}
              />
            </div>
          </div>
        </Panel>

        <Panel title="SUMMARIZER LIMITS">
          <div className="space-y-5">
            <Input
              label="LAST SEC BYTES (summarize threshold)"
              type="number"
              min={1024}
              value={agentSettings.summarizerLastSecBytes}
              onChange={(e) =>
                setAgentSettings((s) => ({
                  ...s,
                  summarizerLastSecBytes: Math.max(1024, parseInt(e.target.value) || 1024),
                }))
              }
            />
<<<<<<< HEAD
            <p className="text-xxs font-mono text-mc-text-ghost -mt-3">
              {(agentSettings.summarizerLastSecBytes / 1024).toFixed(0)} KB
=======
            <p className="text-xxs font-mono text-muted -mt-3">
              {(agentSettings.summarizerMaxInputBytes / 1024).toFixed(0)} KB
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
            </p>

            <Input
              label="MAX QA BYTES (aggressive summarize)"
              type="number"
              min={1024}
              value={agentSettings.summarizerMaxQABytes}
              onChange={(e) =>
                setAgentSettings((s) => ({
                  ...s,
                  summarizerMaxQABytes: Math.max(1024, parseInt(e.target.value) || 1024),
                }))
              }
            />
<<<<<<< HEAD
            <p className="text-xxs font-mono text-mc-text-ghost -mt-3">
              {(agentSettings.summarizerMaxQABytes / 1024).toFixed(0)} KB
=======
            <p className="text-xxs font-mono text-muted -mt-3">
              {(agentSettings.summarizerMaxOutputBytes / 1024).toFixed(0)} KB
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
            </p>
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={saveAgents}>
            SAVE CHANGES
          </Button>
        </div>
      </div>
    )
  }

  function renderMCP() {
    return (
      <div className="space-y-6">
        <Panel title="MCP SERVER CONFIGURATION">
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-3 py-2 border-b border-border">
              <DataLabel>SERVER</DataLabel>
              <DataLabel>URL</DataLabel>
              <DataLabel>STATUS</DataLabel>
              <DataLabel>ACTION</DataLabel>
            </div>

            {/* Server Rows */}
            {mcpServers.map((server) => (
              <div
                key={server.name}
                className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-3 py-3 border-b border-border last:border-b-0 items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-foreground font-bold uppercase tracking-wider">
                    {server.name}
                  </span>
                  <span className="text-xxs font-mono text-muted">
                    :{server.port}
                  </span>
                </div>

                <input
                  type="text"
                  value={server.url}
                  onChange={(e) =>
                    setMcpServers((prev) =>
                      prev.map((s) =>
                        s.name === server.name
                          ? { ...s, url: e.target.value }
                          : s
                      )
                    )
                  }
                  className="w-full bg-background border border-border text-foreground font-mono text-sm px-3 py-1.5 placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
                />

                <div className="flex items-center gap-2 min-w-[80px]">
                  <GlowDot status={server.status} size="md" />
                  <span className="text-xxs font-mono text-muted uppercase">
                    {server.status === 'ok' ? 'ONLINE' : server.status === 'error' ? 'ERROR' : 'OFFLINE'}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  loading={server.testing}
                  onClick={() => testMCPServer(server.name)}
                >
                  TEST
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={saveMCP}>
            SAVE CHANGES
          </Button>
        </div>
      </div>
    )
  }

  function renderUsers() {
    return (
      <div className="space-y-6">
        <Panel
          title="USER MANAGEMENT"
          headerRight={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInviteOpen(!inviteOpen)}
            >
              {inviteOpen ? 'CANCEL' : 'INVITE USER'}
            </Button>
          }
        >
          {/* Invite Form */}
          {inviteOpen && (
            <form onSubmit={handleInviteUser} className="mb-4">
              <div className="border border-border bg-background p-4 space-y-4">
                <DataLabel>NEW USER INVITATION</DataLabel>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="EMAIL"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                  />

                  <Select
                    label="ROLE"
                    value={inviteRole}
                    options={ROLE_OPTIONS.map((r) => ({
                      value: r,
                      label: r.toUpperCase(),
                    }))}
                    onChange={(v) => setInviteRole(v as UserRecord['role'])}
                  />

                  <Input
                    label="PROJECTS (COMMA-SEPARATED IDS)"
                    value={inviteProjects}
                    onChange={(e) => setInviteProjects(e.target.value)}
                    placeholder="proj-1, proj-2"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInviteOpen(false)
                      setInviteEmail('')
                      setInviteRole('operator')
                      setInviteProjects('')
                    }}
                  >
                    CANCEL
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={inviting}>
                    SEND INVITE
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* User Table */}
          <div>
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_0.5fr_1.5fr_0.5fr_auto] gap-3 px-3 py-2 border-b border-border">
              <DataLabel>EMAIL</DataLabel>
              <DataLabel>ROLE</DataLabel>
              <DataLabel>PROJECTS</DataLabel>
              <DataLabel>LAST LOGIN</DataLabel>
              <DataLabel>STATUS</DataLabel>
              <DataLabel>ACTION</DataLabel>
            </div>

            {/* Rows */}
            {users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[2fr_1fr_0.5fr_1.5fr_0.5fr_auto] gap-3 px-3 py-3 border-b border-border last:border-b-0 items-center"
              >
                <span className="text-sm font-mono text-foreground truncate">
                  {user.email}
                </span>

                <select
                  value={user.role}
                  onChange={(e) =>
                    handleUpdateUserRole(user.id, e.target.value as UserRecord['role'])
                  }
                  disabled={user.status === 'inactive'}
                  className="bg-background border border-border text-foreground font-mono text-xs px-2 py-1 focus:border-blue-500/50 focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>

                <span className="text-xs font-mono text-muted text-center">
                  {user.projects}
                </span>

                <span className="text-xs font-mono text-muted">
                  {user.lastLogin ? formatDate(user.lastLogin) : '--'}
                </span>

                <div className="flex items-center gap-1.5">
                  <GlowDot
                    status={user.status === 'active' ? 'ok' : 'offline'}
                    size="sm"
                  />
                  <span className="text-xxs font-mono text-muted uppercase">
                    {user.status}
                  </span>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={user.status === 'inactive'}
                  onClick={() => {
                    setDeactivateTarget(user)
                    setDeactivateOpen(true)
                  }}
                >
                  DEACTIVATE
                </Button>
              </div>
            ))}

            {users.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-muted text-xs font-mono">no users found</p>
              </div>
            )}
          </div>
        </Panel>

        {/* Deactivate Confirm Dialog */}
        <ConfirmDialog
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          title="DEACTIVATE USER"
          description={`Are you sure you want to deactivate ${deactivateTarget?.email ?? 'this user'}? They will lose access to all projects and active sessions will be terminated.`}
          variant="danger"
          confirmLabel="DEACTIVATE"
          loading={deactivating}
          onConfirm={handleDeactivateUser}
        />
      </div>
    )
  }

  function renderHealth() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <DataLabel>SYSTEM HEALTH</DataLabel>
          <Button
            variant="outline"
            size="sm"
            loading={refreshing}
            onClick={refreshHealth}
          >
            REFRESH
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LLM Providers */}
          <Panel title="LLM PROVIDERS">
            <div className="space-y-3">
              {healthData.llmProviders.length === 0 ? (
                <p className="text-muted text-xs font-mono">no data</p>
              ) : (
                healthData.llmProviders.map((p) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GlowDot status={p.status} size="md" />
                      <span className="text-sm font-mono text-foreground uppercase tracking-wider">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.latency != null && (
                        <span className="text-xxs font-mono text-muted">
                          {p.latency}ms
                        </span>
                      )}
                      {p.error && (
                        <span className="text-xxs font-mono text-red-400 truncate max-w-[150px]">
                          {p.error}
                        </span>
                      )}
                      <span className="text-xxs font-mono text-muted uppercase">
                        {p.status === 'ok' ? 'ONLINE' : p.status === 'error' ? 'ERROR' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* MCP Servers */}
          <Panel title="MCP SERVERS">
            <div className="space-y-3">
              {healthData.mcpServers.length === 0 ? (
                <p className="text-muted text-xs font-mono">no data</p>
              ) : (
                healthData.mcpServers.map((s) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GlowDot status={s.status} size="md" />
                      <span className="text-sm font-mono text-foreground uppercase tracking-wider">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.error && (
                        <span className="text-xxs font-mono text-red-400 truncate max-w-[150px]">
                          {s.error}
                        </span>
                      )}
                      <span className="text-xxs font-mono text-muted uppercase">
                        {s.status === 'ok' ? 'ONLINE' : s.status === 'error' ? 'ERROR' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* Databases */}
          <Panel title="DATABASES">
            <div className="space-y-3">
              {healthData.databases.length === 0 ? (
                <>
                  {['PostgreSQL', 'Neo4j', 'Redis'].map((name) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GlowDot status="offline" size="md" />
                        <span className="text-sm font-mono text-foreground uppercase tracking-wider">
                          {name}
                        </span>
                      </div>
                      <span className="text-xxs font-mono text-muted uppercase">
                        OFFLINE
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                healthData.databases.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GlowDot status={d.status} size="md" />
                      <span className="text-sm font-mono text-foreground uppercase tracking-wider">
                        {d.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.latency != null && (
                        <span className="text-xxs font-mono text-muted">
                          {d.latency}ms
                        </span>
                      )}
                      <span className="text-xxs font-mono text-muted uppercase">
                        {d.status === 'ok' ? 'ONLINE' : d.status === 'error' ? 'ERROR' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* Docker / Kali Sandbox */}
          <Panel title="DOCKER">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GlowDot status={healthData.docker.status} size="md" />
                  <span className="text-sm font-mono text-foreground uppercase tracking-wider">
                    {healthData.docker.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {healthData.docker.latency != null && (
                    <span className="text-xxs font-mono text-muted">
                      {healthData.docker.latency}ms
                    </span>
                  )}
                  <span className="text-xxs font-mono text-muted uppercase">
                    {healthData.docker.status === 'ok'
                      ? 'ONLINE'
                      : healthData.docker.status === 'error'
                        ? 'ERROR'
                        : 'OFFLINE'}
                  </span>
                </div>
              </div>
              {healthData.docker.error && (
                <p className="text-xxs font-mono text-red-400">{healthData.docker.error}</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  // ── Tab Content Map ────────────────────────────────────────────────────────

  const TAB_CONTENT: Record<TabKey, () => React.ReactNode> = {
    general: renderGeneral,
    llm: renderLLM,
    agents: renderAgents,
    mcp: renderMCP,
    users: renderUsers,
    health: renderHealth,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContentShell variant="surface">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">System configuration and administration</p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors relative
              ${
                activeTab === tab.key
                  ? 'text-blue-500'
                  : 'text-muted hover:text-muted'
              }
            `}
          >
            {tab.label}
            {/* Active underline */}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px] overflow-y-auto">
        {loading ? <TabSkeleton /> : TAB_CONTENT[activeTab]()}
      </div>
    </PageContentShell>
  )
}
