'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowUpRight, Search, StopCircle, Trash2, Workflow, Download, X } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusDot } from '@/components/ui/status-dot'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BulkActionsBar, DataTable, type Column, type SortState } from '@/components/ui/data-table'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { activity, flows as flowsApi } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import { cn, timeAgo } from '@/lib/utils'
import { useUrlStateMulti } from '@/hooks/useUrlState'
import { useDensity } from '@/hooks/useDensity'
import type { FlowStatus, Phase } from '@/types'

type FlowSummary = {
  id: string
  name: string
  status: FlowStatus
  phase: Phase
  updated_at: string
  project_id?: string
  project_name?: string
}

type ActivityEvent = {
  id: string
  created_at: string
  flow?: FlowSummary
}

const STATUS_TABS: Array<{ value: 'all' | FlowStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

const DEFAULTS: Record<string, string> = { status: 'all', q: '', phase: 'all', sort: '', dir: '' }

/**
 * Flows — cross-project list, now URL-synced + bulk-selectable.
 *
 * URL params:
 *   ?status=running   — filter by FlowStatus or "all"
 *   ?phase=recon      — filter by Phase or "all"
 *   ?q=login          — free-text filter (name or project)
 *   ?sort=name&dir=asc
 *
 * Bulk actions surface a pinned action bar when rows are checked (cancel /
 * delete / export CSV). Each action is a best-effort call per id and toasts
 * at the end with the success tally.
 */
export default function FlowsPage() {
  const { data, isLoading, mutate } = useSWR(
    '/api/activity?flows',
    () => activity.list().then((r) => r.data as ActivityEvent[]),
    { refreshInterval: 10_000 },
  )

  const [filters, setFilters] = useUrlStateMulti(DEFAULTS)
  const [density] = useDensity()
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const flows = React.useMemo(() => deDup(data ?? []), [data])

  const filtered = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return flows.filter((f) => {
      if (filters.status !== 'all' && f.status !== filters.status) return false
      if (filters.phase !== 'all' && f.phase !== filters.phase) return false
      if (q && !(f.name.toLowerCase().includes(q) || f.project_name?.toLowerCase().includes(q))) return false
      return true
    })
  }, [flows, filters])

  const sort: SortState =
    filters.sort ? { columnId: filters.sort, direction: (filters.dir || 'asc') as 'asc' | 'desc' } : null

  const runningCount = flows.filter((f) => f.status === 'running').length

  // ── Bulk actions ──
  const selectedRows = filtered.filter((f) => selected.has(f.id))
  const cancellable = selectedRows.filter((f) => f.status === 'running' || f.status === 'paused')

  const handleCancel = async () => {
    const ids = cancellable.map((f) => f.id)
    if (ids.length === 0) {
      toast.info('Nothing to cancel in selection')
      return
    }
    const results = await Promise.allSettled(ids.map((id) => flowsApi.cancel(id)))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    toast.success(`Cancelled ${ok}/${ids.length} flows`)
    setSelected(new Set())
    void mutate()
  }

  const handleDelete = async () => {
    const ids = selectedRows.map((f) => f.id)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} flow(s)? This cannot be undone.`)) return
    const results = await Promise.allSettled(ids.map((id) => flowsApi.delete(id)))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    toast.success(`Deleted ${ok}/${ids.length} flows`)
    setSelected(new Set())
    void mutate()
  }

  const handleExport = () => {
    const rows = selectedRows.map((f) => ({
      id: f.id,
      name: f.name,
      project: f.project_name ?? '',
      status: f.status,
      phase: f.phase,
      updated_at: f.updated_at,
    }))
    const header = Object.keys(rows[0] ?? {}).join(',')
    const body = rows.map((r) =>
      Object.values(r)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    ).join('\n')
    const csv = `${header}\n${body}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flows-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} flows`)
  }

  const columns: Column<FlowSummary>[] = React.useMemo(
    () => [
      {
        id: 'name',
        header: 'Flow',
        sortable: true,
        sortValue: (f) => f.name.toLowerCase(),
        cell: (f) => (
          <Link
            href={`/flows/${f.id}`}
            className="flex items-center gap-2.5 min-w-0 focus-ring rounded"
          >
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md border shrink-0',
                STATUS_CLASSES[f.status].border,
                STATUS_CLASSES[f.status].bg,
              )}
            >
              <StatusDot
                tone={f.status === 'running' ? 'accent' : 'muted'}
                pulse={STATUS_CLASSES[f.status].pulse}
                size={5}
              />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-fg truncate">{f.name}</div>
              <div className="meta-mono mt-0.5 truncate">
                {f.project_name ?? 'Unknown project'}
              </div>
            </div>
          </Link>
        ),
      },
      {
        id: 'phase',
        header: 'Phase',
        sortable: true,
        sortValue: (f) => f.phase,
        hideOnMobile: true,
        cell: (f) => <span className="text-xs text-fg-muted font-mono">{PHASE_LABEL[f.phase]}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (f) => f.status,
        cell: (f) => (
          <Badge
            variant="outline"
            className={cn(STATUS_CLASSES[f.status].text, STATUS_CLASSES[f.status].border)}
          >
            {STATUS_LABEL[f.status]}
          </Badge>
        ),
      },
      {
        id: 'updated',
        header: 'Updated',
        sortable: true,
        sortValue: (f) => new Date(f.updated_at).getTime(),
        align: 'right',
        hideOnMobile: true,
        cell: (f) => (
          <span className="meta-mono">{timeAgo(f.updated_at)}</span>
        ),
      },
      {
        id: 'chev',
        header: '',
        align: 'right',
        width: 44,
        cell: () => <ArrowUpRight className="h-3 w-3 text-fg-subtle" />,
      },
    ],
    [],
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Pipelines"
        title="Flows"
        subtitle={
          flows.length === 0
            ? 'No flows yet. Launch one from a project to see it here.'
            : `${flows.length} total · ${runningCount} running`
        }
      />

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <Tabs value={filters.status} onValueChange={(v) => setFilters({ status: v })}>
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 sm:max-w-md">
          <Input
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Filter by name or project…"
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
            containerClassName="flex-1"
            size="md"
            aria-label="Filter flows"
          />
        </div>
      </div>

      <div className="mt-6">
        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={handleCancel}
            disabled={cancellable.length === 0}
          >
            <StopCircle className="h-3.5 w-3.5" />
            Cancel ({cancellable.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5 text-sev-critical border-sev-critical/40 hover:bg-sev-critical/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </BulkActionsBar>

        <DataTable
          ariaLabel="Flows"
          columns={columns}
          rows={filtered}
          getRowId={(f) => f.id}
          selected={selected}
          onSelectChange={setSelected}
          sort={sort}
          onSortChange={(s) =>
            setFilters({ sort: s?.columnId ?? '', dir: s?.direction ?? '' })
          }
          density={density}
          loading={isLoading}
          empty={<EmptyFlows hasFilter={Boolean(filters.q || filters.status !== 'all' || filters.phase !== 'all')} />}
        />
      </div>
    </PageShell>
  )
}

function EmptyFlows({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
        <Workflow className="h-4 w-4 text-fg-subtle" />
      </div>
      <div>
        <div className="text-sm font-medium text-fg">
          {hasFilter ? 'No flows match' : 'No flows yet'}
        </div>
        <div className="mt-1 text-xs text-fg-muted max-w-sm">
          {hasFilter
            ? 'Change the status filter or clear your search.'
            : 'Launch one from a project to see it here.'}
        </div>
      </div>
      <Link href="/projects" className="text-xs text-accent hover:underline underline-offset-4">
        Browse projects →
      </Link>
    </div>
  )
}

/** Collapse the activity feed into one entry per flow id. */
function deDup(events: ActivityEvent[]): FlowSummary[] {
  const byId = new Map<string, FlowSummary>()
  for (const e of events) {
    if (!e.flow) continue
    const existing = byId.get(e.flow.id)
    if (!existing || new Date(e.flow.updated_at) > new Date(existing.updated_at)) {
      byId.set(e.flow.id, e.flow)
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}
