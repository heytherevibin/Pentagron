'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Filter,
  Search,
  UserCircle2,
  Workflow,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { activity } from '@/lib/api'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
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
  type: string
  message: string
  status?: string
  actor?: string
  created_at: string
  flow?: FlowSummary
}

const TYPE_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'flow', label: 'Flows' },
  { value: 'approval', label: 'Approvals' },
  { value: 'auth', label: 'Auth' },
  { value: 'system', label: 'System' },
]

/**
 * Activity — the system-wide audit stream. Everything the agent and operators
 * do, in reverse-chronological order. Filterable by type and free-text.
 */
export default function ActivityPage() {
  const { data, isLoading } = useSWR(
    '/api/activity',
    () => activity.list().then((r) => r.data as ActivityEvent[]),
    { refreshInterval: 10_000 },
  )
  const [filter, setFilter] = React.useState<string>('all')
  const [query, setQuery] = React.useState('')

  const events = React.useMemo(() => data ?? [], [data])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (filter !== 'all' && !e.type.toLowerCase().includes(filter)) return false
      if (q) {
        const hay = `${e.message} ${e.actor ?? ''} ${e.flow?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [events, filter, query])

  // Group by day (local time) for the header dividers.
  const grouped = React.useMemo(() => groupByDay(filtered), [filtered])

  return (
    <PageShell>
      <PageHeader
        eyebrow="Audit"
        title="Activity"
        subtitle={
          events.length === 0
            ? 'No activity yet — everything the system does will appear here.'
            : `${events.length} events · live stream`
        }
      />

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            {TYPE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter message, actor, flow…"
          leftSlot={<Search />}
          containerClassName="sm:max-w-xs"
          size="md"
          aria-label="Filter activity"
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={!!query || filter !== 'all'} />
          ) : (
            <div>
              {grouped.map(({ label, items }) => (
                <section key={label}>
                  <div className="flex items-center gap-2 px-4 py-2 bg-bg-subtle/40 border-y border-border-subtle">
                    <Filter className="h-3 w-3 text-fg-subtle" />
                    <span className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
                      {label}
                    </span>
                    <span className="text-2xs text-fg-subtle font-mono">· {items.length}</span>
                  </div>
                  <ul className="divide-y divide-border-subtle">
                    {items.map((e) => (
                      <ActivityRow key={e.id} event={e} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const body = (
    <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 hover:bg-bg-subtle/60 transition-colors duration-120">
      <span
        className={cn(
          'mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle',
          event.type.includes('approval') && 'border-sev-high/30 text-sev-high',
          event.type.includes('flow') && 'border-accent/30 text-accent',
        )}
      >
        {event.type.includes('flow') ? (
          <Workflow className="h-3.5 w-3.5" />
        ) : event.type.includes('approval') ? (
          <UserCircle2 className="h-3.5 w-3.5" />
        ) : (
          <ActivityIcon className="h-3.5 w-3.5 text-fg-subtle" />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-fg truncate">{event.message}</div>
        <div className="mt-0.5 text-2xs text-fg-subtle font-mono truncate">
          {timeAgo(event.created_at)} · {formatDateTime(event.created_at)}
          {event.actor ? ` · ${event.actor}` : ''}
          {event.flow ? ` · ${event.flow.name}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-2xs uppercase">
          {event.type}
        </Badge>
        {event.flow && <ArrowUpRight className="h-3 w-3 text-fg-subtle" />}
      </div>
    </div>
  )

  if (event.flow) {
    return (
      <li>
        <Link href={`/flows/${event.flow.id}`}>{body}</Link>
      </li>
    )
  }
  return <li>{body}</li>
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border-subtle">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div>
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-2.5 w-80 mt-2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-14 px-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
        <ActivityIcon className="h-4 w-4 text-fg-subtle" />
      </div>
      <div>
        <div className="text-sm font-medium text-fg">
          {hasQuery ? 'No events match' : 'No activity yet'}
        </div>
        <div className="mt-1 text-xs text-fg-muted max-w-sm">
          {hasQuery
            ? 'Clear the filter or broaden your search.'
            : 'Start a flow, approve a phase, or sign a user in — events will stream here.'}
        </div>
      </div>
    </div>
  )
}

function groupByDay(events: ActivityEvent[]): Array<{ label: string; items: ActivityEvent[] }> {
  const groups = new Map<string, ActivityEvent[]>()
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const today = new Date()
  const todayKey = today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayKey = yesterday.toDateString()

  for (const e of events) {
    const d = new Date(e.created_at)
    const key = d.toDateString()
    const label =
      key === todayKey ? 'Today' : key === yesterdayKey ? 'Yesterday' : fmt.format(d)
    const list = groups.get(label) ?? []
    list.push(e)
    groups.set(label, list)
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}
