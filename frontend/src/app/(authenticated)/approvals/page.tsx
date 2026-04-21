'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowUpRight, ShieldCheck, ShieldAlert, Inbox } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { activity, flows as flowsApi } from '@/lib/api'
import { PHASE_LABEL } from '@/lib/constants'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
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

/**
 * Approvals — cross-flow queue. The backend only exposes approvals per flow,
 * so we derive the set of flows from the activity feed and fan-out a fetch
 * per flow. In practice only a handful of flows are ever active, so this
 * stays lean.
 */
export default function ApprovalsPage() {
  const { data: activityData, isLoading: activityLoading } = useSWR(
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

  // Single SWR key composed from the flow list. The fetcher fans out to each
  // flow's approvals endpoint and flattens the response.
  const {
    data: approvals,
    isLoading: approvalsLoading,
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

  const [tab, setTab] = React.useState<'pending' | 'resolved' | 'all'>('pending')

  const all = approvals ?? []
  const pending = all.filter((a) => a.status === 'pending')
  const resolved = all.filter((a) => a.status !== 'pending')
  const visible = tab === 'pending' ? pending : tab === 'resolved' ? resolved : all

  const isLoading = activityLoading || approvalsLoading

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
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
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

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          visible.map((a) => <ApprovalRow key={a.id} approval={a} />)
        )}
      </div>
    </PageShell>
  )
}

function ApprovalRow({ approval: a }: { approval: Enriched }) {
  const tone =
    a.status === 'pending'
      ? 'border-sev-high/30 bg-sev-high/[0.02]'
      : a.status === 'approved'
        ? 'border-accent/30 bg-accent/[0.02]'
        : 'border-sev-critical/30 bg-sev-critical/[0.02]'

  const icon =
    a.status === 'pending' ? (
      <ShieldAlert className="h-3.5 w-3.5 text-sev-high" />
    ) : a.status === 'approved' ? (
      <ShieldCheck className="h-3.5 w-3.5 text-accent" />
    ) : (
      <ShieldAlert className="h-3.5 w-3.5 text-sev-critical" />
    )

  return (
    <Card className={cn('overflow-hidden border', tone)}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle">
            {icon}
          </span>
          <div className="min-w-0">
            <CardTitle className="text-sm truncate">{a.description}</CardTitle>
            <div className="mt-0.5 text-2xs text-fg-subtle font-mono truncate">
              {a.flow.project_name ?? 'Project'} · {a.flow.name} · {timeAgo(a.created_at)} ·{' '}
              {formatDateTime(a.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="uppercase">
            {PHASE_LABEL[a.phase]}
          </Badge>
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
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="flex items-center justify-end">
          <Button asChild variant="ghost" size="sm" rightIcon={<ArrowUpRight />}>
            <Link href={`/flows/${a.flow.id}?tab=approvals`}>Open flow</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-2.5 w-80 mt-2" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

function EmptyState({ tab }: { tab: 'pending' | 'resolved' | 'all' }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center text-center gap-3 py-14 px-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
          <Inbox className="h-4 w-4 text-fg-subtle" />
        </div>
        <div>
          <div className="text-sm font-medium text-fg">
            {tab === 'pending'
              ? 'Inbox zero'
              : tab === 'resolved'
                ? 'Nothing resolved yet'
                : 'No approvals recorded'}
          </div>
          <div className="mt-1 text-xs text-fg-muted max-w-sm">
            {tab === 'pending'
              ? 'No flow is currently waiting on you. Phase-gated approvals appear here the moment an agent requests one.'
              : 'Approve or reject a request from a flow and it will show up here.'}
          </div>
        </div>
        <Link href="/flows" className="text-xs text-accent hover:underline underline-offset-4">
          Browse flows →
        </Link>
      </CardContent>
    </Card>
  )
}
