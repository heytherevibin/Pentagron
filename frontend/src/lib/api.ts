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
  reportDownload: (id: string) =>
    api.get(`/api/flows/${id}/report`, { responseType: 'blob' }),
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

// ── WebSocket URL builder ─────────────────────────────────────────────────────

export function wsUrl(path: string): string {
  const wsBase = (process.env.NEXT_PUBLIC_WS_URL ?? BASE_URL).replace(/^http/, 'ws')
  const token = typeof window !== 'undefined' ? localStorage.getItem('pentagron_token') : ''
  return `${wsBase}${path}?token=${token}`
}
