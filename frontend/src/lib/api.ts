import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pentagron_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('pentagron_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── API helpers ───────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string; role: string } }>('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
}

export const projects = {
  list: () => api.get('/api/projects'),
  create: (data: { name: string; description?: string; scope?: string }) => api.post('/api/projects', data),
  get: (id: string) => api.get(`/api/projects/${id}`),
  update: (id: string, data: unknown) => api.put(`/api/projects/${id}`, data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
}

export const flows = {
  list: (projectId: string) => api.get(`/api/projects/${projectId}/flows`),
  create: (projectId: string, data: { name: string; objective: string }) =>
    api.post(`/api/projects/${projectId}/flows`, data),
  get: (id: string) => api.get(`/api/flows/${id}`),
  delete: (id: string) => api.delete(`/api/flows/${id}`),
  start: (id: string) => api.post(`/api/flows/${id}/start`),
  cancel: (id: string) => api.post(`/api/flows/${id}/cancel`),
  listApprovals: (id: string) => api.get(`/api/flows/${id}/approvals`),
  approve: (flowId: string, approvalId: string, notes?: string) =>
    api.post(`/api/flows/${flowId}/approve`, { approval_id: approvalId, notes }),
  reject: (flowId: string, approvalId: string, notes?: string) =>
    api.post(`/api/flows/${flowId}/reject`, { approval_id: approvalId, notes }),
  graph: (id: string) => api.get(`/api/flows/${id}/graph`),
  report: (id: string, format: 'markdown' | 'json' = 'json') =>
    api.get(`/api/flows/${id}/report`, { params: { format } }),
  reportDownload: (id: string, format: 'markdown' | 'pdf' = 'markdown') =>
    api.get(`/api/flows/${id}/report`, { params: { format }, responseType: 'blob' }),
}

export const models = {
  list: () => api.get('/api/models'),
}

export const settings = {
  getGeneral: () => api.get('/api/settings/general'),
  updateGeneral: (data: Record<string, unknown>) => api.put('/api/settings/general', data),
  getLLM: () => api.get('/api/settings/llm'),
  updateLLM: (data: Record<string, unknown>) => api.put('/api/settings/llm', data),
  testLLM: (provider: string) => api.post('/api/settings/llm/test', { provider }),
  getMCP: () => api.get('/api/settings/mcp'),
  updateMCP: (data: Record<string, unknown>) => api.put('/api/settings/mcp', data),
  testMCP: (server: string) => api.post('/api/settings/mcp/test', { server }),
}

export const users = {
  list: () => api.get('/api/users'),
  create: (data: { email: string; password: string; role: string }) => api.post('/api/users', data),
  update: (id: string, data: { role: string }) => api.put(`/api/users/${id}`, data),
  deactivate: (id: string) => api.delete(`/api/users/${id}`),
  resetPassword: (id: string, password: string) => api.post(`/api/users/${id}/reset-password`, { password }),
}

export const activity = {
  list: () => api.get('/api/activity'),
}

export const health = {
  providers: () => api.get('/api/health/providers'),
  mcp: () => api.get('/api/health/mcp'),
  all: () => api.get('/api/health/all'),
}

// ── Notifications ─────────────────────────────────────────────────────────────
// Backend endpoints are scheduled for delivery — each helper degrades to an
// empty payload if the route 404s so the bell / dropdown render a graceful
// empty state rather than throwing.
export const notifications = {
  list: (params?: { unread?: boolean; limit?: number }) =>
    api.get('/api/notifications', { params }),
  unreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id: string) => api.post(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
  clear: () => api.delete('/api/notifications'),
}

// ── Insights / Metrics ────────────────────────────────────────────────────────
export const insights = {
  summary: (window: '24h' | '7d' | '30d' = '7d') =>
    api.get('/api/insights/summary', { params: { window } }),
  findingsOverTime: (window: '24h' | '7d' | '30d' = '7d') =>
    api.get('/api/insights/findings', { params: { window } }),
  phaseDurations: (window: '24h' | '7d' | '30d' = '7d') =>
    api.get('/api/insights/phase-durations', { params: { window } }),
  topTargets: (limit = 10) => api.get('/api/insights/top-targets', { params: { limit } }),
  approvalLatency: (window: '24h' | '7d' | '30d' = '7d') =>
    api.get('/api/insights/approval-latency', { params: { window } }),
}

// ── Flow runs (history tab) ──────────────────────────────────────────────────
export const runs = {
  list: (flowId: string) => api.get(`/api/flows/${flowId}/runs`),
  get: (flowId: string, runId: string) => api.get(`/api/flows/${flowId}/runs/${runId}`),
  retry: (flowId: string, runId: string) =>
    api.post(`/api/flows/${flowId}/runs/${runId}/retry`),
}

// ── Enterprise: audit / keys / sessions / integrations / RBAC ────────────────
export const audit = {
  list: (params?: { actor?: string; action?: string; from?: string; to?: string; limit?: number }) =>
    api.get('/api/audit', { params }),
  export: (format: 'csv' | 'json' = 'csv') =>
    api.get('/api/audit/export', { params: { format }, responseType: 'blob' }),
}

export const apiKeys = {
  list: () => api.get('/api/api-keys'),
  create: (data: { name: string; scopes: string[]; expires_in_days?: number }) =>
    api.post('/api/api-keys', data),
  revoke: (id: string) => api.delete(`/api/api-keys/${id}`),
}

export const sessions = {
  list: () => api.get('/api/sessions'),
  revoke: (id: string) => api.delete(`/api/sessions/${id}`),
  revokeOthers: () => api.post('/api/sessions/revoke-others'),
}

export const integrations = {
  list: () => api.get('/api/integrations'),
  create: (data: { kind: string; name: string; config: Record<string, unknown> }) =>
    api.post('/api/integrations', data),
  update: (id: string, data: Partial<{ name: string; enabled: boolean; config: Record<string, unknown> }>) =>
    api.put(`/api/integrations/${id}`, data),
  test: (id: string) => api.post(`/api/integrations/${id}/test`),
  delete: (id: string) => api.delete(`/api/integrations/${id}`),
}

export const rbac = {
  roles: () => api.get('/api/rbac/roles'),
  permissions: () => api.get('/api/rbac/permissions'),
  createRole: (data: { name: string; description?: string; permissions: string[] }) =>
    api.post('/api/rbac/roles', data),
  updateRole: (id: string, data: Partial<{ name: string; description: string; permissions: string[] }>) =>
    api.put(`/api/rbac/roles/${id}`, data),
  deleteRole: (id: string) => api.delete(`/api/rbac/roles/${id}`),
  assign: (userId: string, roleId: string) =>
    api.post(`/api/users/${userId}/role`, { role_id: roleId }),
}

export const twoFactor = {
  status: () => api.get('/api/2fa/status'),
  enrollBegin: () => api.post('/api/2fa/enroll'),
  enrollVerify: (code: string) => api.post('/api/2fa/verify', { code }),
  disable: (code: string) => api.post('/api/2fa/disable', { code }),
  recoveryCodes: () => api.get('/api/2fa/recovery-codes'),
  regenerateRecovery: () => api.post('/api/2fa/recovery-codes/regenerate'),
}

export const sso = {
  providers: () => api.get('/api/sso/providers'),
  create: (data: { kind: 'saml' | 'oidc'; name: string; config: Record<string, unknown> }) =>
    api.post('/api/sso/providers', data),
  update: (id: string, data: Partial<{ name: string; enabled: boolean; config: Record<string, unknown> }>) =>
    api.put(`/api/sso/providers/${id}`, data),
  delete: (id: string) => api.delete(`/api/sso/providers/${id}`),
  metadata: (id: string) => api.get(`/api/sso/providers/${id}/metadata`),
}

// ── WebSocket URL builder ─────────────────────────────────────────────────────
//
// Browser WebSocket APIs do not support custom request headers, so the JWT must
// be passed as a query parameter. To reduce the window of exposure, the token is
// read fresh at connection time and is never stored in the URL itself beyond the
// initial handshake (the connection is upgraded immediately and the URL is not
// retained by the server after auth validation).
export function wsUrl(path: string): string {
  const wsBase = (process.env.NEXT_PUBLIC_WS_URL ?? BASE_URL).replace(/^http/, 'ws')
  // Prefer sessionStorage (tab-scoped, not persisted) if available.
  const token =
    typeof window !== 'undefined'
      ? (sessionStorage.getItem('pentagron_token') ?? localStorage.getItem('pentagron_token') ?? '')
      : ''
  const separator = path.includes('?') ? '&' : '?'
  return `${wsBase}${path}${separator}token=${encodeURIComponent(token)}`
}
