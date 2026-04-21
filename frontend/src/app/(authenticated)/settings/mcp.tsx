'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Save, Zap, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/ui/status-dot'
import { settings } from '@/lib/api'

import { SettingsCard } from './settings-card'

type MCPConfig = {
  naabu_url?: string
  sqlmap_url?: string
  nuclei_url?: string
  metasploit_url?: string
  kali_sandbox_url?: string
}

const SERVERS: Array<{ key: keyof MCPConfig; serverKey: string; label: string; hint: string; defaultUrl: string }> = [
  { key: 'naabu_url',        serverKey: 'naabu',        label: 'Naabu',         hint: 'Fast port scanner',           defaultUrl: 'http://localhost:8000' },
  { key: 'sqlmap_url',       serverKey: 'sqlmap',       label: 'SQLMap',        hint: 'SQL injection automation',     defaultUrl: 'http://localhost:8001' },
  { key: 'nuclei_url',       serverKey: 'nuclei',       label: 'Nuclei',        hint: 'Template-based vuln scanner',  defaultUrl: 'http://localhost:8002' },
  { key: 'metasploit_url',   serverKey: 'metasploit',   label: 'Metasploit',    hint: 'Exploit framework',            defaultUrl: 'http://localhost:8003' },
  { key: 'kali_sandbox_url', serverKey: 'kali-sandbox', label: 'Kali sandbox',  hint: 'Shell-exec inside Kali image',  defaultUrl: 'http://localhost:8004' },
]

export function MCPSettings() {
  const { data, isLoading, mutate } = useSWR('/api/settings/mcp', () =>
    settings.getMCP().then((r) => r.data as { config?: MCPConfig }),
  )
  const [form, setForm] = React.useState<MCPConfig>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (data?.config) setForm(data.config)
  }, [data])

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await settings.updateMCP(form as Record<string, unknown>)
      toast.success('MCP servers saved')
      mutate()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not save', { description: e.response?.data?.error })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="MCP endpoints"
        description="One entry per MCP-wrapped tool. Each server speaks the Model Context Protocol over HTTP/SSE. Set the base URL of the container as exposed to the backend."
      >
        <div className="flex flex-col gap-5 max-w-xl">
          {SERVERS.map((s) => (
            <MCPField
              key={s.key}
              server={s}
              value={(form[s.key] as string) ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, [s.key]: v }))}
            />
          ))}
        </div>
      </SettingsCard>

      <div className="flex items-center justify-end">
        <Button variant="primary" size="md" onClick={save} loading={saving} leftIcon={<Save />}>
          Save MCP servers
        </Button>
      </div>
    </div>
  )
}

function MCPField({
  server,
  value,
  onChange,
}: {
  server: { key: string; serverKey: string; label: string; hint: string; defaultUrl: string }
  value: string
  onChange: (v: string) => void
}) {
  const [testing, setTesting] = React.useState(false)
  const [result, setResult] = React.useState<null | 'ok' | 'fail'>(null)

  async function test() {
    if (testing) return
    setTesting(true)
    setResult(null)
    try {
      const res = await settings.testMCP(server.serverKey)
      const data = res.data as { success?: boolean; online?: boolean }
      const ok = data.success ?? data.online ?? true
      setResult(ok ? 'ok' : 'fail')
      ok ? toast.success(`${server.label} · reachable`) : toast.error(`${server.label} · test failed`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setResult('fail')
      toast.error(`${server.label} · test failed`, { description: e.response?.data?.error })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`m-${server.serverKey}`} hint={server.hint}>
          {server.label}
        </Label>
        <div className="flex items-center gap-2">
          {result === 'ok' && <StatusDot tone="accent" size={6} />}
          {result === 'fail' && <StatusDot tone="danger" size={6} />}
          <button
            type="button"
            onClick={test}
            disabled={testing || !value}
            className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-120 disabled:opacity-40"
          >
            {testing ? (
              <Zap className="h-3 w-3 animate-pulse text-accent" />
            ) : result === 'ok' ? (
              <CheckCircle2 className="h-3 w-3 text-accent" />
            ) : result === 'fail' ? (
              <XCircle className="h-3 w-3 text-sev-critical" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            Test
          </button>
        </div>
      </div>
      <Input
        id={`m-${server.serverKey}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={server.defaultUrl}
        className="font-mono text-xs"
      />
    </div>
  )
}
