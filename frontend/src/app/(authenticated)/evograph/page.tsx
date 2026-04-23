'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowUpRight, Network, Workflow } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/ui/status-dot'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { GraphView } from '@/components/graph/graph-view'
import { activity, flows as flowsApi } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import { cn, timeAgo } from '@/lib/utils'
import type { FlowStatus, GraphEdge, GraphNode, Phase } from '@/types'

type FlowSummary = {
  id: string
  name: string
  status: FlowStatus
  phase: Phase
  updated_at: string
  project_id?: string
  project_name?: string
}

type ActivityEvent = { id: string; created_at: string; flow?: FlowSummary }

/**
 * EvoGraph — force-directed attack-chain memory visualiser.
 *
 * The backend exposes graph data per-flow at `GET /api/flows/:id/graph`. On
 * this page we surface a picker (recent flows derived from the activity feed)
 * and, when one is selected via `?flow=<id>`, render its full attack chain.
 *
 * The same GraphView is embedded inside the flow detail's "Graph" tab so the
 * two surfaces stay visually identical.
 */
export default function EvoGraphPage() {
  return (
    <React.Suspense fallback={<PageShell><div className="h-10" /></PageShell>}>
      <EvoGraphPageInner />
    </React.Suspense>
  )
}

function EvoGraphPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const flowId = params.get('flow') ?? ''

  const { data: activityData, isLoading: activityLoading } = useSWR(
    '/api/activity?evograph',
    () => activity.list().then((r) => r.data as { events?: ActivityEvent[] }),
    { refreshInterval: 15_000 },
  )

  const recentFlows = React.useMemo(() => {
    const m = new Map<string, FlowSummary>()
    for (const e of activityData?.events ?? []) {
      if (!e.flow) continue
      const existing = m.get(e.flow.id)
      if (!existing || new Date(e.flow.updated_at) > new Date(existing.updated_at)) {
        m.set(e.flow.id, e.flow)
      }
    }
    return [...m.values()].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  }, [activityData])

  const { data: graphData, isLoading: graphLoading } = useSWR(
    flowId ? ['graph', flowId] : null,
    async () => {
      const r = await flowsApi.graph(flowId)
      const d = r.data as { nodes?: GraphNode[]; edges?: GraphEdge[]; links?: GraphEdge[] }
      return {
        nodes: d.nodes ?? [],
        edges: d.edges ?? d.links ?? [],
      }
    },
    { refreshInterval: flowId ? 10_000 : 0 },
  )

  const selectedFlow = recentFlows.find((f) => f.id === flowId)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Attack memory"
        title="EvoGraph"
        subtitle={
          selectedFlow
            ? `Attack chain for ${selectedFlow.name}`
            : 'Cross-session memory of every target, finding, and exploit path.'
        }
        actions={
          flowId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/evograph')}
            >
              Clear selection
            </Button>
          ) : null
        }
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Graph surface */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            {!flowId ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
                  <Network className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-sm font-medium text-fg">Pick a flow to visualise</div>
                  <div className="mt-1 text-xs text-fg-muted max-w-sm">
                    EvoGraph renders one attack chain at a time. Select a flow on the right —
                    nodes and edges update live while the agent works.
                  </div>
                </div>
              </div>
            ) : graphLoading ? (
              <Skeleton className="h-[520px] w-full" />
            ) : (
              <GraphView
                nodes={graphData?.nodes ?? []}
                edges={graphData?.edges ?? []}
                height={560}
                emptyLabel="No graph nodes yet"
                onNodeOpen={(n) => {
                  // Shallow-routes to the flow detail, carrying the node id so
                  // the timeline can scroll to the relevant event (future work).
                  router.push(`/flows/${flowId}?node=${n.id}`)
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Flow picker */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Flows</CardTitle>
            <Link
              href="/flows"
              className="inline-flex items-center gap-1 meta-mono hover:text-fg transition-colors duration-120"
            >
              All flows
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {activityLoading ? (
              <FlowPickerSkeleton />
            ) : recentFlows.length === 0 ? (
              <div className="py-6 text-center text-xs text-fg-subtle">
                No flows yet. Launch one from a project to start building the graph.
              </div>
            ) : (
              <ul className="flex flex-col -my-1">
                {recentFlows.slice(0, 12).map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/evograph?flow=${f.id}`)}
                      className={cn(
                        'group w-full text-left flex items-center gap-3 py-2.5 border-b border-border-subtle/60 last:border-b-0',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 rounded',
                      )}
                      aria-pressed={f.id === flowId}
                    >
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-md border',
                          STATUS_CLASSES[f.status].border,
                          STATUS_CLASSES[f.status].bg,
                        )}
                      >
                        <StatusDot
                          tone={f.status === 'running' ? 'accent' : 'muted'}
                          pulse={STATUS_CLASSES[f.status].pulse}
                          size={6}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'text-xs font-medium truncate',
                            f.id === flowId ? 'text-accent' : 'text-fg group-hover:text-fg',
                          )}
                        >
                          {f.name}
                        </div>
                        <div className="mt-0.5 text-2xs text-fg-subtle font-mono truncate">
                          {PHASE_LABEL[f.phase]} · {timeAgo(f.updated_at)}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          STATUS_CLASSES[f.status].text,
                          STATUS_CLASSES[f.status].border,
                          'hidden sm:inline-flex',
                        )}
                      >
                        {STATUS_LABEL[f.status]}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Primer card — only when nothing selected */}
      {!flowId && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">How EvoGraph works</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Primer
                icon={Workflow}
                title="Live attack chains"
                body="Every reasoning step, tool call, and finding is written to the graph as the agent works — not reconstructed at the end."
              />
              <Primer
                icon={Network}
                title="Cross-session memory"
                body="Nodes persist beyond a single flow so subsequent engagements can reuse prior reconnaissance and credentials."
              />
              <Primer
                icon={ArrowUpRight}
                title="Click a node → jump"
                body="Any node in the graph deep-links back to the timeline event, the finding card, or the flow that produced it."
              />
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  )
}

function Primer({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-subtle/30 p-3.5">
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle">
        <Icon className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="text-xs font-medium text-fg">{title}</div>
      <div className="text-2xs text-fg-muted leading-relaxed">{body}</div>
    </div>
  )
}

function FlowPickerSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 py-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-2.5 w-48 mt-1.5" />
          </div>
        </div>
      ))}
    </div>
  )
}
