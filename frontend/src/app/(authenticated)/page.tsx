'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { motion } from 'framer-motion'
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
import { Card, CardContent, CardHeader, CardTitle, SurfaceCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/ui/status-dot'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { projects, activity, health } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import type { Project, Flow } from '@/types'
import { timeAgo, cn } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────────────────── */
/*   Motion orchestration variants                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
} as const

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
} as const

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
} as const

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

  /* Provider health ratio for the ring gauge */
  const healthAll = [...(healthData?.providers ?? []), ...(healthData?.mcp ?? [])]
  const healthOnline = healthAll.filter((x) => x.online).length

  return (
    <div className="relative mx-auto w-full max-w-[1320px] px-shell py-6 sm:py-8 lg:py-10">
      {/* ── Ambient background glows ──────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Primary orb — top-left */}
        <div
          className="absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: 'hsl(var(--accent))' }}
        />
        {/* Secondary orb — bottom-right */}
        <div
          className="absolute -bottom-[15%] -right-[10%] h-[500px] w-[500px] rounded-full opacity-[0.04] blur-[100px]"
          style={{ background: 'hsl(var(--accent))' }}
        />
        {/* Noise texture — very subtle */}
        <div className="absolute inset-0 opacity-[0.025] bg-noise mix-blend-overlay" />
      </div>

      {/* ── Content — above the ambient layer ─────────────────────────────── */}
      <motion.div
        className="relative z-10"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ── Greeting + CTA ──────────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <div className="text-2xs uppercase tracking-widest text-accent font-mono mb-2 inline-flex items-center gap-2">
              <StatusDot tone="accent" pulse size={5} />
              Operator dashboard
            </div>
            <h1
              className="text-3xl lg:text-4xl tracking-tighter font-semibold"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--fg)) 0%, hsl(var(--fg-muted)) 80%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Welcome back.
            </h1>
            <p className="mt-2 text-sm text-fg-muted max-w-xl leading-relaxed">
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
        </motion.div>

        {/* ── Hero stats strip ────────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3"
        >
          <StatCard
            index={0}
            label="Projects"
            value={projectList.length}
            icon={FolderKanban}
            hint="Total engagements"
            sparkData={[1, 2, 1, 3, 2, 4, projectList.length]}
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
            ring={{ value: healthOnline, max: healthAll.length || 1 }}
          />
        </motion.div>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4"
        >
          {/* Recent flows */}
          <GlassCard>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Recent flows</CardTitle>
              <Link
                href="/flows"
                className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-accent transition-colors duration-200"
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
                <ul className="divide-y divide-white/[0.04]">
                  {flows.slice(0, 6).map((flow, i) => (
                    <FlowRow key={flow.id} flow={flow} index={i} />
                  ))}
                </ul>
              )}
            </CardContent>
          </GlassCard>

          {/* Provider + MCP health */}
          <GlassCard>
            <CardHeader>
              <CardTitle className="text-sm">System health</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <HealthPanel data={healthData} />
            </CardContent>
          </GlassCard>
        </motion.div>

        {/* ── Recent activity ─────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <GlassCard className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Recent activity</CardTitle>
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-accent transition-colors duration-200"
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
                  {events.slice(0, 8).map((e, i) => (
                    <ActivityRow key={e.id} event={e} index={i} />
                  ))}
                </ul>
              )}
            </CardContent>
          </GlassCard>
        </motion.div>

        {/* Projects preview */}
        {!projectsLoading && projectList.length > 0 && (
          <motion.div variants={fadeUp}>
            <GlassCard className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Projects</CardTitle>
                <Link
                  href="/projects"
                  className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-accent transition-colors duration-200"
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
            </GlassCard>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   GlassCard — wrapper with glassmorphic styling + surface hairline        */
/* ────────────────────────────────────────────────────────────────────────── */

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg',
        'bg-bg-subtle/20 backdrop-blur-xl',
        'border border-white/[0.06]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),_0_1px_3px_rgba(0,0,0,0.3)]',
        'transition-all duration-300',
        'hover:border-white/[0.1]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_4px_12px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      {/* Noise overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.02] bg-noise mix-blend-overlay"
      />
      {/* Top-edge hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Sub-components                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function FlowRow({ flow, index = 0 }: { flow: FlowSummary; index?: number }) {
  const styles = STATUS_CLASSES[flow.status]
  return (
    <li>
      <Link
        href={`/flows/${flow.id}`}
        className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md border',
              'border-white/[0.08] bg-white/[0.03]',
            )}
          >
            <StatusDot tone={flow.status === 'running' ? 'accent' : 'muted'} pulse={styles.pulse} size={5} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-fg truncate group-hover:text-accent transition-colors duration-200">{flow.name}</div>
            <div className="mt-0.5 text-2xs text-fg-subtle font-mono">
              {PHASE_LABEL[flow.phase]} · {timeAgo(flow.updated_at)}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn(styles.text, 'border-white/[0.08]')}>
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
        className="group block rounded-md border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 hover:-translate-y-px"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-fg truncate group-hover:text-accent transition-colors duration-200">{project.name}</div>
          <ArrowUpRight className="h-3 w-3 text-fg-subtle group-hover:text-accent transition-colors duration-200" />
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
          {i > 0 && <Separator className="my-2 bg-white/[0.04]" />}
          <div className="flex items-center justify-between group/row py-0.5 hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              <StatusDot
                tone={r.online ? 'accent' : 'danger'}
                pulse={r.online}
                size={5}
              />
              <span className="text-xs text-fg truncate">{r.name}</span>
            </div>
            <span className="text-2xs font-mono uppercase tracking-widest text-fg-subtle">
              {r.group} · <span className={r.online ? 'text-accent' : 'text-sev-critical'}>{r.online ? 'online' : 'offline'}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ActivityRow({ event, index = 0 }: { event: ActivityEvent; index?: number }) {
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors duration-150">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/40" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-fg truncate">{event.message}</div>
        <div className="mt-0.5 text-2xs text-fg-subtle font-mono">
          {timeAgo(event.created_at)}
          {event.actor ? ` · ${event.actor}` : ''}
        </div>
      </div>
      <Badge variant="outline" className="text-2xs uppercase border-white/[0.08]">{event.type}</Badge>
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
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
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
    <div className="flex flex-col divide-y divide-white/[0.04]">
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
