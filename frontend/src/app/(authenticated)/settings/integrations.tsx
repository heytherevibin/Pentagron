'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Bell, CheckCircle2, Mail, PauseCircle, Plug, Plus, Slack, Trash2, Webhook, XCircle, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SettingsCard } from './settings-card'
import { integrations as integrationsApi } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'
import type { Integration } from '@/types'

const CATALOG: Array<{
  kind: Integration['kind']
  name: string
  icon: React.ElementType
  blurb: string
}> = [
  { kind: 'slack',     name: 'Slack',     icon: Slack,   blurb: 'Channel alerts for approvals, critical findings, and flow completion.' },
  { kind: 'jira',      name: 'Jira',      icon: Zap,     blurb: 'Open an issue per critical/high finding, linked back to the flow.' },
  { kind: 'webhook',   name: 'Webhook',   icon: Webhook, blurb: 'Post raw JSON events to any HTTPS endpoint. HMAC-signed.' },
  { kind: 'email',     name: 'Email',     icon: Mail,    blurb: 'Digest email with the day\'s findings, sent to a mailing list.' },
  { kind: 'pagerduty', name: 'PagerDuty', icon: Bell,    blurb: 'Escalate critical findings to your on-call rotation.' },
]

/**
 * IntegrationsSettings — catalogue of supported destinations + status of
 * the ones you've connected. Rows show last delivery and let you toggle
 * on/off, test, or delete.
 */
export function IntegrationsSettings() {
  const { data, isLoading, mutate } = useSWR<Integration[]>(
    '/api/integrations',
    async () => {
      try {
        const r = await integrationsApi.list()
        const d = r.data as { integrations?: Integration[] } | Integration[]
        return Array.isArray(d) ? d : (d.integrations ?? [])
      } catch {
        return []
      }
    },
  )

  const rows = data ?? []
  const [addKind, setAddKind] = React.useState<Integration['kind'] | null>(null)

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await integrationsApi.update(id, { enabled })
      void mutate()
    } catch {
      toast.error('Could not toggle')
    }
  }

  const handleTest = async (id: string) => {
    try {
      await integrationsApi.test(id)
      toast.success('Test delivery sent')
    } catch {
      toast.error('Test failed — check configuration')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this integration? Events stop flowing immediately.')) return
    try {
      await integrationsApi.delete(id)
      toast.success('Integration deleted')
      void mutate()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <>
      <SettingsCard
        title="Integrations"
        description="Pipe Pentagron events to the tools your team already uses. Every integration is signed and retryable."
      >
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 rounded-md skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((r) => (
              <ConnectedCard
                key={r.id}
                integration={r}
                onToggle={(v) => handleToggle(r.id, v)}
                onTest={() => handleTest(r.id)}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>
        )}

        {/* Catalogue */}
        <div className="mt-6">
          <div className="meta-mono mb-2">Add integration</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CATALOG.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.kind}
                  type="button"
                  onClick={() => setAddKind(c.kind)}
                  className={cn(
                    'group flex items-start gap-3 text-left rounded-md border border-border-subtle bg-bg-subtle/30 p-3',
                    'hover:border-border-strong hover:bg-bg-subtle/60 transition-colors duration-120',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                  )}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle shrink-0">
                    <Icon className="h-3.5 w-3.5 text-accent" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-fg">{c.name}</div>
                    <div className="mt-0.5 text-2xs text-fg-muted leading-relaxed">{c.blurb}</div>
                  </div>
                  <Plus className="h-3 w-3 text-fg-subtle shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            })}
          </div>
        </div>
      </SettingsCard>

      <AddIntegrationDialog
        kind={addKind}
        onClose={() => setAddKind(null)}
        onCreated={() => {
          setAddKind(null)
          void mutate()
        }}
      />
    </>
  )
}

function ConnectedCard({
  integration,
  onToggle,
  onTest,
  onDelete,
}: {
  integration: Integration
  onToggle: (v: boolean) => void
  onTest: () => void
  onDelete: () => void
}) {
  const meta = CATALOG.find((c) => c.kind === integration.kind)
  const Icon = meta?.icon ?? Plug
  const healthy = !integration.last_error
  return (
    <Card className={cn(integration.enabled ? 'border-accent/30' : 'border-border-subtle')}>
      <CardContent className="p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle shrink-0">
            <Icon className="h-3.5 w-3.5 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-fg truncate">{integration.name}</div>
              <Switch
                checked={integration.enabled}
                onCheckedChange={onToggle}
                aria-label={`${integration.enabled ? 'Disable' : 'Enable'} ${integration.name}`}
              />
            </div>
            <div className="meta-mono mt-1 flex items-center gap-1.5">
              {healthy ? (
                <CheckCircle2 className="h-3 w-3 text-accent" />
              ) : (
                <XCircle className="h-3 w-3 text-sev-critical" />
              )}
              <span>
                {integration.last_delivery_at
                  ? `Last delivered ${timeAgo(integration.last_delivery_at)}`
                  : 'Never delivered'}
              </span>
              {!integration.enabled && (
                <>
                  <span className="text-fg-disabled">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <PauseCircle className="h-3 w-3" /> Paused
                  </span>
                </>
              )}
            </div>
            {integration.last_error && (
              <div className="mt-1.5 text-2xs text-sev-critical truncate" title={integration.last_error}>
                {integration.last_error}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onTest}>
            Test
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-fg-subtle hover:text-sev-critical"
            onClick={onDelete}
            aria-label="Delete integration"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AddIntegrationDialog({
  kind,
  onClose,
  onCreated,
}: {
  kind: Integration['kind'] | null
  onClose: () => void
  onCreated: () => void
}) {
  const meta = CATALOG.find((c) => c.kind === kind)
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [channel, setChannel] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setName('')
    setUrl('')
    setChannel('')
  }, [kind])

  if (!kind) return null

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const config: Record<string, unknown> = {}
      if (kind === 'webhook' || kind === 'slack') config.url = url
      if (kind === 'slack') config.channel = channel
      if (kind === 'email') config.to = url
      if (kind === 'jira' || kind === 'pagerduty') config.token = url
      await integrationsApi.create({ kind, name: name.trim(), config })
      toast.success(`${meta?.name ?? 'Integration'} connected`)
      onCreated()
    } catch {
      toast.error('Could not connect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(kind)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {meta?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="integ-name">Name</Label>
            <Input
              id="integ-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${meta?.name} · production`}
              className="mt-1.5"
            />
          </div>
          {(kind === 'webhook' || kind === 'slack' || kind === 'email' || kind === 'jira' || kind === 'pagerduty') && (
            <div>
              <Label htmlFor="integ-url">
                {kind === 'webhook' ? 'Endpoint URL' :
                 kind === 'slack' ? 'Incoming webhook URL' :
                 kind === 'email' ? 'Recipients (comma-separated)' :
                 kind === 'jira' ? 'API token' :
                 'Integration key'}
              </Label>
              <Input
                id="integ-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1.5 font-mono text-xs"
              />
            </div>
          )}
          {kind === 'slack' && (
            <div>
              <Label htmlFor="integ-channel">Channel</Label>
              <Input
                id="integ-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#pentagron-alerts"
                className="mt-1.5 font-mono text-xs"
              />
            </div>
          )}
          <p className="text-2xs text-fg-subtle leading-relaxed">
            Credentials are encrypted at rest. Pentagron signs every delivery with a workspace-scoped
            HMAC so your receiver can verify authenticity.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Connecting…' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
