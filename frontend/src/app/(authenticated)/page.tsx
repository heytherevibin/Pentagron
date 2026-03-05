'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
<<<<<<< HEAD
import { projects as projectsApi, flows as flowsApi, activity as activityApi } from '@/lib/api'
import type { Project, Flow } from '@/types'
=======
import {
  ProjectOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { projects as projectsApi, activity as activityApi } from '@/lib/api'
import type { Project } from '@/types'
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
<<<<<<< HEAD
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface ActivityItem {
  id: string
  type: string
  description: string
  created_at: string
=======
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DashboardPageSkeleton } from '@/components/ui/Skeleton'
import { PageContentShell } from '@/components/layout/PageContentShell'

interface ActivityEvent {
  flow_name: string
  project_name: string
  status: string
  phase: string
  type: string
  description: string
  timestamp: string
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
}

export default function DashboardPage() {
  const [projectList, setProjectList] = useState<Project[]>([])
<<<<<<< HEAD
  const [allFlows, setAllFlows] = useState<Flow[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Fetch projects
        const projRes = await projectsApi.list()
        const projData = projRes.data
        const list: Project[] = Array.isArray(projData)
          ? projData
          : projData?.data ?? projData?.projects ?? []
        setProjectList(list)

        // Fetch flows for each project in parallel to compute live stats
        const flowResults = await Promise.allSettled(
          list.map((p) => flowsApi.list(p.id))
        )
        const flows: Flow[] = flowResults.flatMap((r) => {
          if (r.status !== 'fulfilled') return []
          const d = r.value.data
          return Array.isArray(d) ? d : d?.data ?? d?.flows ?? []
        })
        setAllFlows(flows)

        // Fetch recent activity
        try {
          const actRes = await activityApi.list()
          const actData = actRes.data
          const items: ActivityItem[] = Array.isArray(actData)
            ? actData
            : actData?.data ?? actData?.activity ?? []
          setActivityFeed(items.slice(0, 10))
        } catch {
          // Activity feed is non-critical; ignore errors
        }
      } catch {
        setProjectList([])
      } finally {
        setLoading(false)
      }
    }
    load()
=======
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      projectsApi.list(),
      activityApi.list().catch(() => ({ data: [] })),
    ])
      .then(([projRes, actRes]) => {
        const pData = projRes.data
        const list = Array.isArray(pData) ? pData : pData?.data ?? pData?.projects ?? []
        setProjectList(list)
        const aData = actRes.data
        setActivity(Array.isArray(aData) ? aData : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
  }, [])

  const activeFlows = allFlows.filter((f) => f.status === 'running' || f.status === 'paused').length
  const pendingApprovals = allFlows.filter((f) => f.status === 'paused').length

  // Count flows per project for the table
  const flowsByProject = allFlows.reduce<Record<string, number>>((acc, f) => {
    acc[f.project_id] = (acc[f.project_id] ?? 0) + 1
    return acc
  }, {})

  if (loading) {
<<<<<<< HEAD
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="stat" />
          ))}
        </div>
        <Skeleton variant="card" className="h-48" />
        <Skeleton variant="card" className="h-32" />
      </div>
    )
=======
    return <DashboardPageSkeleton />
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
  }

  return (
    <PageContentShell>
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Pentagron mission control overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<<<<<<< HEAD
        <StatCard label="PROJECTS" value={projectList.length} accent="emerald" />
        <StatCard label="ACTIVE FLOWS" value={activeFlows} accent="blue" />
        <StatCard label="PENDING APPROVALS" value={pendingApprovals} accent="amber" />
        <StatCard label="TOTAL FLOWS" value={allFlows.length} accent="crimson" />
=======
        <StatCard
          label="Projects"
          value={projectList.length}
          accent="emerald"
          icon={<ProjectOutlined style={{ fontSize: 18 }} />}
        />
        <StatCard
          label="Active Flows"
          value={0}
          accent="blue"
          icon={<ThunderboltOutlined style={{ fontSize: 18 }} />}
        />
        <StatCard
          label="Pending Approvals"
          value={0}
          accent="amber"
          icon={<SafetyCertificateOutlined style={{ fontSize: 18 }} />}
        />
        <StatCard
          label="Findings"
          value={0}
          accent="red"
          icon={<BugOutlined style={{ fontSize: 18 }} />}
        />
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
      </div>

      {/* Active engagements */}
      <Panel
        title="Active Engagements"
        headerRight={
          <Link href="/projects/new">
            <Button variant="primary" size="sm" icon={<PlusOutlined />}>
              New Project
            </Button>
          </Link>
        }
      >
        {projectList.length === 0 ? (
          <EmptyState
            title="No active engagements"
            description="Create your first project to begin autonomous pentesting"
            action={
              <Link href="/projects/new">
                <Button variant="primary" icon={<PlusOutlined />}>
                  New Project
                </Button>
              </Link>
            }
          />
        ) : (
          <div>
            {/* Header row */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border">
              <span className="panel-header-text">Name</span>
              <span className="panel-header-text">Scope</span>
              <span className="panel-header-text">Flows</span>
              <span className="panel-header-text">Status</span>
            </div>

            {/* Project rows */}
<<<<<<< HEAD
            {projectList.map((project) => {
              const flowCount = flowsByProject[project.id] ?? 0
              const hasActive = allFlows.some(
                (f) => f.project_id === project.id && (f.status === 'running' || f.status === 'paused')
              )
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-3 py-3 border-b border-mc-border last:border-b-0 hover:bg-mc-surface-hover transition-colors cursor-pointer"
                >
                  <span className="text-sm font-mono text-mc-text truncate">
                    {project.name}
                  </span>
                  <span className="text-xs font-mono text-mc-text-dim truncate">
                    {project.scope || '--'}
                  </span>
                  <span className="text-xs font-mono text-mc-text-dim">
                    {flowCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GlowDot status={hasActive ? 'ok' : 'offline'} size="sm" />
                    <span className="text-xxs font-mono uppercase text-mc-text-muted">
                      {hasActive ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </span>
                </Link>
              )
            })}
=======
            {projectList.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-mono text-foreground truncate">
                  {project.name}
                </span>
                <span className="text-xs font-mono text-muted truncate">
                  {project.scope || '--'}
                </span>
                <span className="text-xs font-mono text-muted">
                  --
                </span>
                <StatusBadge status="completed" variant="flow" />
              </Link>
            ))}
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
          </div>
        )}
      </Panel>

<<<<<<< HEAD
      {/* Recent activity */}
      <Panel title="RECENT ACTIVITY">
        {activityFeed.length === 0 ? (
          <p className="text-mc-text-muted text-xs font-mono">no recent activity</p>
        ) : (
          <div className="space-y-1">
            {activityFeed.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-1 py-1.5 border-b border-mc-border last:border-b-0">
                <StatusBadge status="info" size="xs" />
                <span className="text-xs font-mono text-mc-text-dim flex-1 truncate">
                  {item.description}
                </span>
                <span className="text-xxs font-mono text-mc-text-muted whitespace-nowrap">
                  {new Date(item.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
=======
      {/* Recent activity — wired to GET /api/activity */}
      <Panel title="Recent Activity">
        {activity.length === 0 ? (
          <p className="text-muted text-xs font-mono">
            No recent flow activity
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.slice(0, 10).map((evt, i) => (
              <li key={`${evt.flow_name}-${evt.timestamp}-${i}`} className="text-xs font-mono border-b border-border pb-2 last:border-0">
                <span className="text-muted">
                  {evt.timestamp
                    ? new Date(evt.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
                <span className="text-foreground ml-2">{evt.description}</span>
              </li>
            ))}
          </ul>
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
        )}
      </Panel>
    </div>
    </PageContentShell>
  )
}
