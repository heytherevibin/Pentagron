'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowUpRight, Search, Workflow } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { StatusDot } from '@/components/ui/status-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { activity } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import { cn, timeAgo } from '@/lib/utils'
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

/**
 * Flows — cross-project list. The backend doesn't currently expose a
 * "list all flows" endpoint, so we synthesise from the activity feed and
 * de-duplicate by flow id.
 */
export default function FlowsPage() {
  const { data, isLoading } = useSWR(
    '/api/activity?flows',
    () => activity.list().then((r) => r.data as ActivityEvent[]),
    { refreshInterval: 10_000 },
  )
  const [filter, setFilter] = React.useState<'all' | FlowStatus>('all')
  const [query, setQuery] = React.useState('')

  const flows = React.useMemo(() => deDup(data ?? []), [data])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return flows.filter((f) => {
      if (filter !== 'all' && f.status !== filter) return false
      if (q && !(f.name.toLowerCase().includes(q) || f.project_name?.toLowerCase().includes(q))) return false
      return true
    })
  }, [flows, filter, query])

  const runningCount = flows.filter((f) => f.status === 'running').length

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
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or project…"
          leftSlot={<Search />}
          containerClassName="sm:max-w-xs"
          size="md"
          aria-label="Filter flows"
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyFlows />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filtered.map((f) => (
                <FlowRow key={f.id} flow={f} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}

function FlowRow({ flow }: { flow: FlowSummary }) {
  const styles = STATUS_CLASSES[flow.status]
  return (
    <li>
      <Link
        href={`/flows/${flow.id}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-bg-subtle/60 transition-colors duration-120"
      >
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', styles.border, styles.bg)}>
          <StatusDot tone={flow.status === 'running' ? 'accent' : 'muted'} pulse={styles.pulse} size={6} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium text-fg truncate">{flow.name}</div>
          <div className="mt-0.5 text-2xs text-fg-subtle font-mono truncate">
            {flow.project_name ?? 'Unknown project'} · {PHASE_LABEL[flow.phase]} · {timeAgo(flow.updated_at)}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className={cn(styles.text, styles.border)}>
            {STATUS_LABEL[flow.status]}
          </Badge>
          <ArrowUpRight className="h-3 w-3 text-fg-subtle" />
        </div>
      </Link>
    </li>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border-subtle">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div><Skeleton className="h-3 w-48" /><Skeleton className="h-2.5 w-64 mt-2" /></div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function EmptyFlows() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
        <Workflow className="h-4 w-4 text-fg-subtle" />
      </div>
      <div>
        <div className="text-sm font-medium text-fg">No flows match</div>
        <div className="mt-1 text-xs text-fg-muted max-w-sm">
          Change the status filter or clear your search. New flows are launched from inside a project.
        </div>
      </div>
      <Link
        href="/projects"
        className="text-xs text-accent hover:underline underline-offset-4"
      >
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
