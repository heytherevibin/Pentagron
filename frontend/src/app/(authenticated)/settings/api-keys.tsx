'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SettingsCard } from './settings-card'
import { apiKeys as apiKeysApi } from '@/lib/api'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import type { ApiKey } from '@/types'

const SCOPES = ['flows:read', 'flows:write', 'findings:read', 'reports:read', 'admin'] as const

/**
 * ApiKeysSettings — list, create, and revoke API keys.
 * Newly minted keys are shown once in a modal, then never stored client-side.
 */
export function ApiKeysSettings() {
  const { data, isLoading, mutate } = useSWR<ApiKey[]>(
    '/api/api-keys',
    async () => {
      try {
        const r = await apiKeysApi.list()
        const d = r.data as { keys?: ApiKey[] } | ApiKey[]
        return Array.isArray(d) ? d : (d.keys ?? [])
      } catch {
        return []
      }
    },
  )

  const [open, setOpen] = React.useState(false)
  const [newKey, setNewKey] = React.useState<{ token: string; key: ApiKey } | null>(null)

  const keys = data ?? []

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this key? Applications using it will immediately lose access.')) return
    try {
      await apiKeysApi.revoke(id)
      toast.success('Key revoked')
      void mutate()
    } catch {
      toast.error('Revoke failed')
    }
  }

  const columns: Column<ApiKey>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (k) => k.name.toLowerCase(),
      cell: (k) => (
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-fg truncate">{k.name}</div>
            <div className="meta-mono mt-0.5 truncate">{k.prefix}••••••</div>
          </div>
        </div>
      ),
    },
    {
      id: 'scopes',
      header: 'Scopes',
      hideOnMobile: true,
      cell: (k) => (
        <div className="flex flex-wrap gap-1">
          {k.scopes.slice(0, 3).map((s) => (
            <Badge key={s} variant="outline" className="text-2xs font-mono">
              {s}
            </Badge>
          ))}
          {k.scopes.length > 3 && (
            <Badge variant="outline" className="text-2xs font-mono text-fg-subtle">
              +{k.scopes.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'last_used',
      header: 'Last used',
      sortable: true,
      sortValue: (k) => (k.last_used_at ? new Date(k.last_used_at).getTime() : 0),
      hideOnMobile: true,
      cell: (k) =>
        k.last_used_at ? (
          <span className="meta-mono">{timeAgo(k.last_used_at)}</span>
        ) : (
          <span className="meta-mono text-fg-disabled">never</span>
        ),
    },
    {
      id: 'created',
      header: 'Created',
      sortable: true,
      sortValue: (k) => new Date(k.created_at).getTime(),
      align: 'right',
      cell: (k) => <span className="meta-mono">{formatDateTime(k.created_at)}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: 60,
      cell: (k) =>
        k.revoked_at ? (
          <Badge variant="outline" className="text-2xs text-fg-disabled">revoked</Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-fg-subtle hover:text-sev-critical"
            onClick={() => handleRevoke(k.id)}
            aria-label="Revoke key"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ),
    },
  ]

  return (
    <>
      <SettingsCard
        title="API keys"
        description="Programmatic access tokens. Scope them narrowly and rotate regularly — Pentagron logs every authenticated request."
        footer={
          <div className="flex items-center justify-end">
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New key
            </Button>
          </div>
        }
      >
        <DataTable
          ariaLabel="API keys"
          columns={columns}
          rows={keys}
          getRowId={(k) => k.id}
          loading={isLoading}
          density="compact"
          empty={
            <div className="py-6 text-center text-xs text-fg-subtle">
              No API keys yet. Generate one to integrate CI, webhooks, or external dashboards.
            </div>
          }
        />
      </SettingsCard>

      <CreateKeyDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(token, key) => {
          setNewKey({ token, key })
          void mutate()
        }}
      />

      <ShowTokenDialog
        data={newKey}
        onClose={() => setNewKey(null)}
      />
    </>
  )
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (token: string, key: ApiKey) => void
}) {
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<Set<string>>(new Set(['flows:read']))
  const [expires, setExpires] = React.useState<'30' | '90' | '365' | 'never'>('90')
  const [saving, setSaving] = React.useState(false)

  const toggleScope = (s: string) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (scopes.size === 0) {
      toast.error('Pick at least one scope')
      return
    }
    setSaving(true)
    try {
      const r = await apiKeysApi.create({
        name: name.trim(),
        scopes: [...scopes],
        expires_in_days: expires === 'never' ? undefined : Number(expires),
      })
      const d = r.data as { token: string; key: ApiKey }
      onCreated(d.token, d.key)
      setName('')
      setScopes(new Set(['flows:read']))
      setExpires('90')
      onOpenChange(false)
    } catch {
      toast.error('Could not create key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub Actions — staging"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Scopes</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScope(s)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded border text-2xs font-mono',
                    'transition-colors duration-120',
                    scopes.has(s)
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'bg-bg-muted border-border text-fg-muted hover:text-fg',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Expires</Label>
            <div className="mt-1.5 flex gap-1.5">
              {(['30', '90', '365', 'never'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setExpires(v)}
                  className={cn(
                    'inline-flex items-center justify-center flex-1 px-2 py-1.5 rounded border text-2xs font-mono',
                    'transition-colors duration-120',
                    expires === v
                      ? 'bg-bg-elevated border-border-strong text-fg'
                      : 'bg-bg-muted border-border text-fg-muted hover:text-fg',
                  )}
                >
                  {v === 'never' ? 'Never' : `${v}d`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShowTokenDialog({
  data,
  onClose,
}: {
  data: { token: string; key: ApiKey } | null
  onClose: () => void
}) {
  const copy = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.token)
    toast.success('Copied to clipboard')
  }

  return (
    <Dialog open={Boolean(data)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save this key — it won&apos;t be shown again</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-fg-muted leading-relaxed">
            This token grants {data?.key.scopes.join(', ') || 'configured'} access. Paste it into your
            secret manager now. If you lose it, revoke and generate a new one — there&apos;s no recovery.
          </p>
          <div className="relative rounded-md border border-border-strong bg-bg-muted p-2.5">
            <code className="block font-mono text-xs text-fg break-all pr-9">{data?.token}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-1.5 right-1.5 h-7 w-7 p-0"
              onClick={copy}
              aria-label="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>
            I&apos;ve saved it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
