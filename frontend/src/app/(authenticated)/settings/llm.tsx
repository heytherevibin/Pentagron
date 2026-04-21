'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Eye, EyeOff, Save, Zap, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/ui/status-dot'
import { settings } from '@/lib/api'

import { SettingsCard } from './settings-card'

type ProviderKey = 'anthropic' | 'openai' | 'openrouter' | 'deepseek' | 'ollama'

type LLMConfig = {
  anthropic_api_key?: string
  openai_api_key?: string
  openrouter_api_key?: string
  deepseek_api_key?: string
  ollama_base_url?: string
  primary_provider?: string
  fallback_order?: string[]
}

const PROVIDERS: Array<{ key: ProviderKey; label: string; hint: string; placeholder: string }> = [
  { key: 'anthropic', label: 'Anthropic', hint: 'Claude · primary reasoning', placeholder: 'sk-ant-…' },
  { key: 'openai', label: 'OpenAI', hint: 'GPT-4 class · fallback + tooling', placeholder: 'sk-…' },
  { key: 'openrouter', label: 'OpenRouter', hint: 'Multi-model routing', placeholder: 'sk-or-…' },
  { key: 'deepseek', label: 'DeepSeek', hint: 'Cost-optimised reasoning', placeholder: 'sk-…' },
  { key: 'ollama', label: 'Ollama', hint: 'Local models (URL instead of key)', placeholder: 'http://localhost:11434' },
]

export function LLMSettings() {
  const { data, isLoading, mutate } = useSWR('/api/settings/llm', () =>
    settings.getLLM().then((r) => r.data as { config?: LLMConfig }),
  )
  const [form, setForm] = React.useState<LLMConfig>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (data?.config) setForm(data.config)
  }, [data])

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await settings.updateLLM(form as Record<string, unknown>)
      toast.success('LLM providers saved')
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
        title="Provider credentials"
        description="Keys are stored encrypted at rest. The primary provider is tried first; fallbacks are attempted on failure or rate limit."
      >
        <div className="flex flex-col gap-5 max-w-xl">
          {PROVIDERS.map((p) => (
            <ProviderField
              key={p.key}
              provider={p}
              value={(form[`${p.key === 'ollama' ? 'ollama_base_url' : (`${p.key}_api_key` as keyof LLMConfig)}`] as string) ?? ''}
              onChange={(v) => {
                const field = p.key === 'ollama' ? 'ollama_base_url' : `${p.key}_api_key`
                setForm((f) => ({ ...f, [field]: v }))
              }}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Routing"
        description="Primary provider handles every turn unless it errors or hits a rate limit — then the fallback chain runs in order."
      >
        <div className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="llm-primary">Primary provider</Label>
            <Input
              id="llm-primary"
              value={form.primary_provider ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, primary_provider: e.target.value }))}
              placeholder="anthropic"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="llm-fallback" hint="comma-separated">
              Fallback order
            </Label>
            <Input
              id="llm-fallback"
              value={(form.fallback_order ?? []).join(', ')}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fallback_order: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="openai, openrouter, deepseek"
            />
          </div>
        </div>
      </SettingsCard>

      <div className="flex items-center justify-end">
        <Button variant="primary" size="md" onClick={save} loading={saving} leftIcon={<Save />}>
          Save providers
        </Button>
      </div>
    </div>
  )
}

function ProviderField({
  provider,
  value,
  onChange,
}: {
  provider: { key: ProviderKey; label: string; hint: string; placeholder: string }
  value: string
  onChange: (v: string) => void
}) {
  const [show, setShow] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [result, setResult] = React.useState<null | 'ok' | 'fail'>(null)
  const isSecret = provider.key !== 'ollama'

  async function test() {
    if (testing) return
    setTesting(true)
    setResult(null)
    try {
      const res = await settings.testLLM(provider.key)
      const data = res.data as { success?: boolean; online?: boolean }
      const ok = data.success ?? data.online ?? true
      setResult(ok ? 'ok' : 'fail')
      ok ? toast.success(`${provider.label} · reachable`) : toast.error(`${provider.label} · test failed`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setResult('fail')
      toast.error(`${provider.label} · test failed`, { description: e.response?.data?.error })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`p-${provider.key}`} hint={provider.hint}>
          {provider.label}
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
        id={`p-${provider.key}`}
        type={isSecret && !show ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={provider.placeholder}
        rightSlot={
          isSecret ? (
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:text-fg transition-colors duration-120"
              aria-label={show ? 'Hide key' : 'Show key'}
              tabIndex={-1}
            >
              {show ? <EyeOff /> : <Eye />}
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
