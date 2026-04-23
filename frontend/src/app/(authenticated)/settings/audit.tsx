'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Download, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type SortState } from '@/components/ui/data-table'
import { SettingsCard } from './settings-card'
import { audit as auditApi } from '@/lib/api'
import { useUrlStateMulti } from '@/hooks/useUrlState'
import { formatDateTime, timeAgo } from '@/lib/utils'
import type { AuditEvent } from '@/types'

const DEFAULTS: Record<string, string> = { q: '', action: 'all', sort: '', dir: '' }

/**
 * AuditSettings — immutable record of every sensitive action on the
 * workspace: auth, settings changes, flow lifecycle, approvals, key rotation.
 *
 * Filters sync to the URL so operators can share a filtered link with
 * security teams. CSV/JSON export wraps the backend streaming endpoint.
 */
export function AuditSettings() {
  const [filters, setFilters] = useUrlStateMulti(DEFAULTS)

  const { data, isLoading } = useSWR<AuditEvent[]>(
    ['audit', filters.q, filters.action],
    async () => {
      try {
        const r = await auditApi.list({
          action: filters.action === 'all' ? undefined : filters.action,
          limit: 500,
        })
        const d = r.data as { events?: AuditEvent[] } | AuditEvent[]
        return Array.isArray(d) ? d : (d.events ?? [])
      } catch {
        return []
      }
    },
    { refreshInterval: 30_000 },
  )

  const rows = React.useMemo(() => {
    const all = data ?? []
    const q = filters.q.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (e) =>
        e.actor_email.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.target_id ?? '').toLowerCase().includes(q) ||
        (e.ip ?? '').toLowerCase().includes(q),
    )
  }, [data, filters.q])

  const sort: SortState =
    filters.sort ? { columnId: filters.sort, direction: (filters.dir || 'asc') as 'asc' | 'desc' } : null

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const r = await auditApi.export(format)
      const blob = new Blob([r.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-${Date.now()}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  const columns: Column<AuditEvent>[] = [
    {
      id: 'when',
      header: 'When',
      sortable: true,
      sortValue: (e) => new Date(e.created_at).getTime(),
      cell: (e) => (
        <div>
          <div className="text-xs text-fg">{formatDateTime(e.created_at)}</div>
          <div className="meta-mono mt-0.5">{timeAgo(e.created_at)}</div>
        </div>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      sortable: true,
      sortValue: (e) => e.actor_email,
      cell: (e) => (
        <div className="min-w-0">
          <div className="text-xs text-fg truncate">{e.actor_email}</div>
          <div className="meta-mono mt-0.5">{e.ip ?? '—'}</div>
        </div>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (e) => e.action,
      cell: (e) => (
        <Badge variant="outline" className="font-mono text-2xs">
          {e.action}
        </Badge>
      ),
    },
    {
      id: 'target',
      header: 'Target',
      hideOnMobile: true,
      cell: (e) => (
        <div className="meta-mono truncate">
          {e.target_type}
          {e.target_id && <span className="text-fg-disabled"> · {e.target_id.slice(0, 8)}</span>}
        </div>
      ),
    },
  ]

  return (
    <SettingsCard
      title="Audit log"
      description="Every sensitive action on this workspace. Immutable, retained per your compliance policy. Export for review or long-term archive."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleExport('json')}>
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport('csv')}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="mb-3">
        <Input
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Filter by actor, action, or target…"
          leftSlot={<Search />}
          rightSlot={
            filters.q ? (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setFilters({ q: '' })}
                className="text-fg-subtle hover:text-fg"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null
          }
          size="md"
          aria-label="Filter audit"
        />
      </div>

      <DataTable
        ariaLabel="Audit log"
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        sort={sort}
        onSortChange={(s) => setFilters({ sort: s?.columnId ?? '', dir: s?.direction ?? '' })}
        loading={isLoading}
        density="compact"
        empty={
          <div className="py-6 text-center text-xs text-fg-subtle">
            No audit events match. Audit entries accumulate as operators and agents act on the workspace.
          </div>
        }
      />
    </SettingsCard>
  )
}
