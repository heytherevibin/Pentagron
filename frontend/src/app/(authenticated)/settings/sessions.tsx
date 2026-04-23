'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Globe, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SettingsCard } from './settings-card'
import { sessions as sessionsApi } from '@/lib/api'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import type { Session } from '@/types'

/**
 * SessionsSettings — shows every active session on the account and lets the
 * user sign specific devices (or everyone-but-me) out. Current-session row is
 * highlighted and can't be revoked from this panel.
 */
export function SessionsSettings() {
  const { data, isLoading, mutate } = useSWR<Session[]>(
    '/api/sessions',
    async () => {
      try {
        const r = await sessionsApi.list()
        const d = r.data as { sessions?: Session[] } | Session[]
        return Array.isArray(d) ? d : (d.sessions ?? [])
      } catch {
        return []
      }
    },
  )

  const rows = data ?? []

  const handleRevoke = async (id: string) => {
    if (!confirm('Sign this session out? The device will need to log in again.')) return
    try {
      await sessionsApi.revoke(id)
      toast.success('Session revoked')
      void mutate()
    } catch {
      toast.error('Revoke failed')
    }
  }

  const handleRevokeOthers = async () => {
    if (
      !confirm(
        'Sign out every other session? This device stays logged in; all other browsers/devices are ejected.',
      )
    ) {
      return
    }
    try {
      await sessionsApi.revokeOthers()
      toast.success('All other sessions signed out')
      void mutate()
    } catch {
      toast.error('Could not revoke others')
    }
  }

  const columns: Column<Session>[] = [
    {
      id: 'device',
      header: 'Device',
      cell: (s) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle shrink-0">
            {deviceIcon(s.user_agent)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-fg truncate">{deviceLabel(s.user_agent)}</span>
              {s.current && (
                <Badge variant="outline" className="text-2xs text-accent border-accent/40">
                  this device
                </Badge>
              )}
            </div>
            <div className="meta-mono mt-0.5 truncate">
              {[s.city, s.country].filter(Boolean).join(', ') || s.ip}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ip',
      header: 'IP',
      hideOnMobile: true,
      cell: (s) => <span className="meta-mono">{s.ip}</span>,
    },
    {
      id: 'last',
      header: 'Last active',
      sortable: true,
      sortValue: (s) => new Date(s.last_active_at).getTime(),
      align: 'right',
      cell: (s) => (
        <span className="meta-mono" title={formatDateTime(s.last_active_at)}>
          {timeAgo(s.last_active_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: 110,
      cell: (s) =>
        s.current ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-fg-subtle hover:text-sev-critical gap-1.5"
            onClick={() => handleRevoke(s.id)}
          >
            <LogOut className="h-3 w-3" />
            Revoke
          </Button>
        ),
    },
  ]

  return (
    <SettingsCard
      title="Active sessions"
      description="Everywhere your Pentagron account is currently signed in. Revoke any session you don't recognise."
      footer={
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRevokeOthers}
            disabled={rows.filter((s) => !s.current).length === 0}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out all other sessions
          </Button>
        </div>
      }
    >
      <DataTable
        ariaLabel="Sessions"
        columns={columns}
        rows={rows}
        getRowId={(s) => s.id}
        loading={isLoading}
        density="compact"
        empty={<div className="py-6 text-center text-xs text-fg-subtle">No active sessions.</div>}
      />
    </SettingsCard>
  )
}

function deviceLabel(ua: string): string {
  if (!ua) return 'Unknown device'
  if (/iPhone/.test(ua)) return 'iPhone · Safari'
  if (/iPad/.test(ua)) return 'iPad · Safari'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh/.test(ua)) return /Chrome/.test(ua) ? 'Mac · Chrome' : /Firefox/.test(ua) ? 'Mac · Firefox' : 'Mac · Safari'
  if (/Windows/.test(ua)) return /Edg\//.test(ua) ? 'Windows · Edge' : /Chrome/.test(ua) ? 'Windows · Chrome' : 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return ua.slice(0, 40)
}

function deviceIcon(ua: string) {
  const cls = 'h-3.5 w-3.5 text-fg-subtle'
  if (/iPhone|Android/.test(ua)) return <Smartphone className={cls} />
  if (/iPad/.test(ua)) return <Tablet className={cls} />
  if (/Macintosh|Windows|Linux/.test(ua)) return <Monitor className={cls} />
  return <Globe className={cn(cls)} />
}
