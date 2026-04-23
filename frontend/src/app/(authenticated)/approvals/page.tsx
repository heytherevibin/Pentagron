'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowUpRight, Check, Inbox, ShieldCheck, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BulkActionsBar, DataTable, type Column, type SortState } from '@/components/ui/data-table'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { activity, flows as flowsApi } from '@/lib/api'
import { PHASE_LABEL } from '@/lib/constants'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { useUrlStateMulti } from '@/hooks/useUrlState'
import { useDensity } from '@/hooks/useDensity'
import type { ApprovalRequest, FlowStatus, Phase } from '@/types'

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
  type: string
  created_at: string
  flow?: FlowSummary
}

type Enriched = ApprovalRequest & { flow: FlowSummary }

const DEFAULTS: Record<string, string> = { tab: 'pending', sort: '', dir: '' }

/**
 * Approvals — cross-flow queue with URL-synced tabs, DataTable render, and
 * bulk approve / reject. Flow enrichment still fans out per-flow since the
 * backend only exposes approvals scoped to a flow.
 */
export default function ApprovalsPage() {
  const { data: activityData } = useSWR(
    '/api/activity?approvals',
    () => activity.list().then((r) => r.data as ActivityEvent[]),
    { refreshInterval: 15_000 },
  )

  const flowMap = React.useMemo(() => {
    const map = new Map<string, FlowSummary>()
    for (const e of activityData ?? []) {
      if (!e.flow) continue
      const existing = map.get(e.flow.id)
      if (!existing || new Date(e.flow.updated_at) > new Date(existing.updated_at)) {
        map.set(e.flow.id, e.flow)
      }
    }
    return map
  }, [activityData])

  const flowIds = React.useMemo(() => [...flowMap.keys()], [flowMap])

  const {
    data: approvals,
    isLoading,
    mutate,
  } = useSWR<Enriched[]>(
    flowIds.length ? ['approvals-bulk', flowIds.join(',')] : null,
    async () => {
      const results = await Promise.allSettled(
        flowIds.map((id) =>
          flowsApi.listApprovals(id).then((r) => {
            const list = r.data as ApprovalRequest[]
            const flow = flowMap.get(id)!
            return list.map((a) => ({ ...a, flow }))
          }),
        ),
      )
      return results
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    { refreshInterval: 15_000 },
  )

  const [filters, setFilters] = useUrlStateMulti(DEFAULTS)
  const [density] = useDensity()
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const all = approvals ?? []
  const pending = all.filter((a) => a.status === 'pending')
  const resolved = all.filter((a) => a.status !== 'pending')
  const visible = filters.tab === 'pending' ? pending : filters.tab === 'resolved' ? resolved : all

  const sort: SortState =
    filters.sort ? { columnId: filters.sort, direction: (filters.dir || 'asc') as 'asc' | 'desc' } : null

  const selectedRows = visible.filter((a) => selected.has(a.id))

  const handleBulk = async (kind: 'approve' | 'reject') => {
    const rows = selectedRows.filter((a) => a.status === 'pending')
    if (rows.length === 0) {
      toast.info('No pending items in selection')
      return
    }
    if (
      kind === 'reject' &&
      !confirm(`Reject ${rows.length} approval(s)? Agents will abort the corresponding phase.`)
    ) {
      return
    }
    const fn = kind === 'approve' ? flowsApi.approve : flowsApi.reject
    const results = await Promise.allSettled(rows.map((a) => fn(a.flow.id, a.id)))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    toast.success(`${kind === 'approve' ? 'Approved' : 'Rejected'} ${ok}/${rows.length}`)
    setSelected(new Set())
    void mutate()
  }

  const columns: Column<Enriched>[] = React.useMemo(
    () => [
      {
        id: 'description',
        header: 'Approval',
        sortable: true,
        sortValue: (a) => a.description.toLowerCase(),
        cell: (a) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle shrink-0">
              {a.status === 'pending' ? (
                <ShieldAlert className="h-3.5 w-3.5 text-sev-high" />
              ) : a.status === 'approved' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-sev-critical" />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-fg truncate">{a.description}</div>
              <div className="meta-mono mt-0.5 truncate">
                {a.flow.project_name ?? 'Project'} · {a.flow.name}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'phase',
        header: 'Phase',
        sortable: true,
        sortValue: (a) => a.phase,
        hideOnMobile: true,
        cell: (a) => <Badge variant="outline" className="uppercase">{PHASE_LABEL[a.phase]}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (a) => a.status,
        cell: (a) => (
          <Badge
            variant="outline"
            className={cn(
              'uppercase',
              a.status === 'pending' && 'text-sev-high border-sev-high/40',
              a.status === 'approved' && 'text-accent border-accent/40',
              a.status === 'rejected' && 'text-sev-critical border-sev-critical/40',
            )}
          >
            {a.status}
          </Badge>
        ),
      },
      {
        id: 'created',
        header: 'Created',
        sortable: true,
        sortValue: (a) => new Date(a.created_at).getTime(),
        align: 'right',
        hideOnMobile: true,
        cell: (a) => (
          <span className="meta-mono" title={formatDateTime(a.created_at)}>
            {timeAgo(a.created_at)}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        align: 'right',
        width: 120,
        cell: (a) => (
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
            <Link href={`/flows/${a.flow.id}?tab=approvals`}>
              Open
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gate"
        title="Approvals"
        subtitle={
          pending.length === 0
            ? 'No pending approvals. Every destructive phase transition lands here first.'
            : `${pending.length} pending · ${resolved.length} resolved`
        }
      />

      <div className="mt-6">
        <Tabs value={filters.tab} onValueChange={(v) => setFilters({ tab: v })}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              {pending.length > 0 && (
                <Badge variant="outline" className="ml-2 text-2xs border-sev-high/30 text-sev-high">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => handleBulk('approve')}
          >
            <Check className="h-3.5 w-3.5 text-accent" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5 text-sev-critical border-sev-critical/40 hover:bg-sev-critical/10"
            onClick={() => handleBulk('reject')}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </BulkActionsBar>

        {visible.length === 0 && !isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center text-center gap-3 py-14 px-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
                <Inbox className="h-4 w-4 text-fg-subtle" />
              </div>
              <div>
                <div className="text-sm font-medium text-fg">
                  {filters.tab === 'pending'
                    ? 'Inbox zero'
                    : filters.tab === 'resolved'
                      ? 'Nothing resolved yet'
                      : 'No approvals recorded'}
                </div>
                <div className="mt-1 text-xs text-fg-muted max-w-sm">
                  {filters.tab === 'pending'
                    ? 'No flow is currently waiting on you. Phase-gated approvals appear here the moment an agent requests one.'
                    : 'Approve or reject a request from a flow and it will show up here.'}
                </div>
              </div>
              <Link href="/flows" className="text-xs text-accent hover:underline underline-offset-4">
                Browse flows →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            ariaLabel="Approvals"
            columns={columns}
            rows={visible}
            getRowId={(a) => a.id}
            selected={selected}
            onSelectChange={setSelected}
            sort={sort}
            onSortChange={(s) =>
              setFilters({ sort: s?.columnId ?? '', dir: s?.direction ?? '' })
            }
            density={density}
            loading={isLoading}
          />
        )}
      </div>
    </PageShell>
  )
}
