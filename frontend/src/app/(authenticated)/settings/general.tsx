'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { settings } from '@/lib/api'

import { SettingsCard } from './settings-card'

type GeneralConfig = {
  workspace_name?: string
  default_timezone?: string
  safe_mode?: boolean
  allow_unscoped_targets?: boolean
  max_concurrent_flows?: number
}

export function GeneralSettings() {
  const { data, isLoading, mutate } = useSWR('/api/settings/general', () =>
    settings.getGeneral().then((r) => r.data as { config?: GeneralConfig }),
  )
  const [form, setForm] = React.useState<GeneralConfig>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (data?.config) setForm(data.config)
  }, [data])

  function field<K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await settings.updateGeneral(form as Record<string, unknown>)
      toast.success('General settings saved')
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
        title="Workspace"
        description="Display name and default timezone applied across reports and audit logs."
      >
        <div className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={form.workspace_name ?? ''}
              onChange={(e) => field('workspace_name', e.target.value)}
              placeholder="Pentagron · Red Team"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-tz" hint="IANA">
              Default timezone
            </Label>
            <Input
              id="ws-tz"
              value={form.default_timezone ?? ''}
              onChange={(e) => field('default_timezone', e.target.value)}
              placeholder="UTC"
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Safety rails"
        description="Hardening knobs. Safe mode blocks exploitation phases entirely; unscoped-target blocking is the default — only disable for sanctioned red-team exercises."
      >
        <div className="flex flex-col gap-5">
          <SwitchRow
            label="Safe mode"
            hint="Blocks all exploitation + post-exploitation phases globally."
            value={!!form.safe_mode}
            onChange={(v) => field('safe_mode', v)}
          />
          <SwitchRow
            label="Allow unscoped targets"
            hint="When off, agents refuse any action on targets not listed in a project scope."
            value={!!form.allow_unscoped_targets}
            onChange={(v) => field('allow_unscoped_targets', v)}
          />
          <div className="flex flex-col gap-1.5 max-w-xs">
            <Label htmlFor="ws-cc">Max concurrent flows</Label>
            <Input
              id="ws-cc"
              type="number"
              min={1}
              max={64}
              value={form.max_concurrent_flows ?? ''}
              onChange={(e) => field('max_concurrent_flows', Number(e.target.value) || 0)}
              placeholder="4"
            />
          </div>
        </div>
      </SettingsCard>

      <div className="flex items-center justify-end">
        <Button variant="primary" size="md" onClick={save} loading={saving} leftIcon={<Save />}>
          Save general settings
        </Button>
      </div>
    </div>
  )
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs font-medium text-fg">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-fg-muted max-w-md">{hint}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
