'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Activity,
  ArrowUpRight,
  FolderKanban,
  Plus,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/ui/status-dot'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { projects, activity, health } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import type { Project, Flow } from '@/types'
import { timeAgo, cn } from '@/lib/utils'

/**
 * Dashboard — the landing page after sign-in.
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  Greeting   + primary CTA                                 │
 *   │  ── hero stats strip ────────────────────────────────     │
 *   │  ┌─── Recent flows ──┐   ┌─── Provider health ──┐         │
 *   │  │  timeline list    │   │  live status rows    │         │
 *   │  └───────────────────┘   └──────────────────────┘         │
 *   │  ── Recent activity ────                                  │
 *   └───────────────────────────────────────────────────────────┘
 */
export default function DashboardPage() {
  const { data: projectsData, isLoading: projectsLoading } = useSWR(
    '/api/projects',
    () => projects.list().then((r) => r.data as Project[]),
    { refreshInterval: 30_000 },
  )
  const { data: activityData, isLoading: activityLoading } = useSWR(
    '/api/activity',
    () => activity.list().then((r) => r.data as ActivityEvent[]),
    { refreshInterval: 15_000 },
  )
  const { data: healthData } = useSWR(
    '/api/health/all',
    () => health.all().then((r) => r.data as HealthSnapshot),
    { refreshInterval: 30_000 },
  )

  const projectList = projectsData ?? []
  const events = activityData ?? []
  const flows = extractRecentFlows(events)
  const runningCount = flows.filter((f) => f.status === 'running').length
  const pendingApprovals = events.filter(
    (e) => e.type === 'approval_request' && e.status === 'pending',
  ).length

  return (
    <div className="mx-auto w-full max-w-[1320px] px-shell py-6 sm:py-8 lg:py-10">
      {/* ── Greeting + CTA ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-2xs uppercase tracking-widest text-accent font-mono mb-2 inline-flex items-center gap-2">
            <StatusDot tone="accent" pulse size={5} />
            Operator dashboard
          </div>
          <h1 className="text-3xl lg:text-4xl tracking-tighter font-medium text-fg">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-fg-muted max-w-xl">
            Resume an engagement, launch a new flow, or review pending approvals. Every
            action is audit-logged and attributed to your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects/new">
            <Button variant="primary" size="md" leftIcon={<Plus />}>
              New project
            </Button>
          </Link>
          <Link href="/flows">
            <Button variant="secondary" size="md" rightIcon={<ArrowUpRight />}>
              View flows
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Hero stats strip ─────────────────────────────────────────────── */}
      <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          index={0}
          label="Projects"
          value={projectList.length}
          icon={FolderKanban}
          hint="Total engagements"
        />
        <StatCard
          index={1}
          label="Running flows"
          value={runningCount}
          icon={Workflow}
          delta={runningCount > 0 ? 'live' : undefined}
          deltaTone={runningCount > 0 ? 'accent' : 'muted'}
          hint={runningCount === 1 ? '1 active pipeline' : `${runningCount} active pipelines`}
        />
        <StatCard
          index={2}
          label="Pending approvals"
          value={pendingApprovals}
          icon={ShieldCheck}
          deltaTone={pendingApprovals > 0 ? 'danger' : 'muted'}
          delta={pendingApprovals > 0 ? 'action required' : undefined}
          hint="Phase-gate queue"
        />
        <StatCard
          index={3}
          label="Provider health"
          value={providerHealthScore(healthData)}
          icon={Zap}
          hint="Online LLM + MCP"
        />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Recent flows */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent flows</CardTitle>
            <Link
              href="/flows"
              className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-120"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {activityLoading ? (
              <FlowListSkeleton />
            ) : flows.length === 0 ? (
              <EmptyState
                icon={Workflow}
                title="No flows yet"
                description="Launch your first engagement to see pipeline activity here."
                cta={{ href: '/projects/new', label: 'Create project' }}
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {flows.slice(0, 6).map((flow) => (
                  <FlowRow key={flow.id} flow={flow} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Provider + MCP health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">System health</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <HealthPanel data={healthData} />
          </CardContent>
        </Card>
      </div>

      {/* ── Recent activity ──────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent activity</CardTitle>
          <Link
            href="/activity"
            className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-120"
          >
            Full log
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {activityLoading ? (
            <ActivitySkeleton />
          ) : events.length === 0 ? (
            <div className="py-8 text-center text-xs text-fg-subtle">
              No recent activity.
            </div>
          ) : (
            <ul className="flex flex-col">
              {events.slice(0, 8).map((e) => (
                <ActivityRow key={e.id} event={e} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Projects preview */}
      {!projectsLoading && projectList.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Projects</CardTitle>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-120"
            >
              Manage
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectList.slice(0, 6).map((p) => (
                <ProjectTile key={p.id} project={p} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Sub-components                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function FlowRow({ flow }: { flow: FlowSummary }) {
  const styles = STATUS_CLASSES[flow.status]
  return (
    <li>
      <Link
        href={`/flows/${flow.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-subtle/60 transition-colors duration-120"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md border',
              styles.border,
              styles.bg,
            )}
          >
            <StatusDot tone={flow.status === 'running' ? 'accent' : 'muted'} pulse={styles.pulse} size={6} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-fg truncate">{flow.name}</div>
            <div className="mt-0.5 text-2xs text-fg-subtle font-mono">
              {PHASE_LABEL[flow.phase]} · {timeAgo(flow.updated_at)}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn(styles.text, styles.border)}>
          {STATUS_LABEL[flow.status]}
        </Badge>
      </Link>
    </li>
  )
}

function ProjectTile({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="group block rounded-md border border-border bg-bg-subtle/30 p-3 hover:bg-bg-subtle/60 hover:border-border-strong transition-colors duration-120"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-fg truncate">{project.name}</div>
          <ArrowUpRight className="h-3 w-3 text-fg-subtle group-hover:text-fg transition-colors duration-120" />
        </div>
        <div className="mt-1 text-2xs text-fg-subtle font-mono truncate">
          {project.description || 'No description'}
        </div>
        <div className="mt-2 text-2xs text-fg-subtle font-mono uppercase tracking-widest">
          {timeAgo(project.updated_at)}
        </div>
      </Link>
    </li>
  )
}

function HealthPanel({ data }: { data?: HealthSnapshot }) {
  const providers = data?.providers ?? []
  const mcp = data?.mcp ?? []
  const rows = [
    ...providers.map((p) => ({ name: p.name, online: p.online, group: 'LLM' })),
    ...mcp.map((m) => ({ name: m.name, online: m.online, group: 'MCP' })),
  ]
  if (rows.length === 0) {
    return (
      <div className="py-4 text-xs text-fg-subtle">
        Health data unavailable.
      </div>
    )
  }
  return (
    <ul className="flex flex-col">
      {rows.map((r, i) => (
        <li key={`${r.group}-${r.name}-${i}`}>
          {i > 0 && <Separator className="my-2" />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot
                tone={r.online ? 'accent' : 'danger'}
                pulse={r.online}
                size={6}
              />
              <span className="text-xs text-fg truncate">{r.name}</span>
            </div>
            <span className="text-2xs font-mono uppercase tracking-widest text-fg-subtle">
              {r.group} · {r.online ? 'online' : 'offline'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-border-subtle/60 last:border-b-0">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-subtle/60" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-fg truncate">{event.message}</div>
        <div className="mt-0.5 text-2xs text-fg-subtle font-mono">
          {timeAgo(event.created_at)}
          {event.actor ? ` · ${event.actor}` : ''}
        </div>
      </div>
      <Badge variant="outline" className="text-2xs uppercase">{event.type}</Badge>
    </li>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: typeof FolderKanban
  title: string
  description: string
  cta?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
        <Icon className="h-4 w-4 text-fg-subtle" />
      </div>
      <div>
        <div className="text-sm font-medium text-fg">{title}</div>
        <div className="mt-1 text-xs text-fg-muted max-w-sm">{description}</div>
      </div>
      {cta && (
        <Link href={cta.href}>
          <Button variant="secondary" size="sm" rightIcon={<ArrowUpRight />}>
            {cta.label}
          </Button>
        </Link>
      )}
    </div>
  )
}

function FlowListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border-subtle">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2.5 w-32 mt-2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Types + helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

type FlowSummary = Pick<Flow, 'id' | 'name' | 'status' | 'phase' | 'updated_at'> & {
  project_id?: string
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

type HealthSnapshot = {
  providers?: { name: string; online: boolean }[]
  mcp?: { name: string; online: boolean }[]
}

function extractRecentFlows(events: ActivityEvent[]): FlowSummary[] {
  const seen = new Set<string>()
  const out: FlowSummary[] = []
  for (const e of events) {
    if (!e.flow) continue
    if (seen.has(e.flow.id)) continue
    seen.add(e.flow.id)
    out.push(e.flow)
  }
  return out
}

function providerHealthScore(data?: HealthSnapshot): string {
  const all = [...(data?.providers ?? []), ...(data?.mcp ?? [])]
  if (all.length === 0) return '—'
  const online = all.filter((x) => x.online).length
  return `${online}/${all.length}`
}
