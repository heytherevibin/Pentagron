'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PlusOutlined } from '@ant-design/icons'
import { projects as projectsApi, flows as flowsApi, activity as activityApi } from '@/lib/api'
import type { Project, Flow } from '@/types'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageContentShell } from '@/components/layout/PageContentShell'

interface ActivityItem {
  id: string
  type: string
  description: string
  created_at: string
}

export default function DashboardPage() {
  const [projectList, setProjectList] = useState<Project[]>([])
  const [allFlows, setAllFlows] = useState<Flow[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const projRes = await projectsApi.list()
        const projData = projRes.data
        const list: Project[] = Array.isArray(projData)
          ? projData
          : projData?.data ?? projData?.projects ?? []
        setProjectList(list)

        const flowResults = await Promise.allSettled(
          list.map((p) => flowsApi.list(p.id))
        )
        const flows: Flow[] = flowResults.flatMap((r) => {
          if (r.status !== 'fulfilled') return []
          const d = r.value.data
          return Array.isArray(d) ? d : d?.data ?? d?.flows ?? []
        })
        setAllFlows(flows)

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
  }, [])

  const activeFlows = allFlows.filter((f) => f.status === 'running' || f.status === 'paused').length
  const pendingApprovals = allFlows.filter((f) => f.status === 'paused').length

  const flowsByProject = allFlows.reduce<Record<string, number>>((acc, f) => {
    acc[f.project_id] = (acc[f.project_id] ?? 0) + 1
    return acc
  }, {})

  if (loading) {
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
        <StatCard label="PROJECTS" value={projectList.length} accent="emerald" />
        <StatCard label="ACTIVE FLOWS" value={activeFlows} accent="blue" />
        <StatCard label="PENDING APPROVALS" value={pendingApprovals} accent="amber" />
        <StatCard label="TOTAL FLOWS" value={allFlows.length} accent="red" />
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
            {projectList.map((project) => {
              const flowCount = flowsByProject[project.id] ?? 0
              const hasActive = allFlows.some(
                (f) => f.project_id === project.id && (f.status === 'running' || f.status === 'paused')
              )
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer items-center"
                >
                  <span className="text-sm font-mono text-foreground truncate">
                    {project.name}
                  </span>
                  <span className="text-xs font-mono text-muted truncate">
                    {project.scope || '--'}
                  </span>
                  <span className="text-xs font-mono text-muted">
                    {flowCount}
                  </span>
                  <StatusBadge status={hasActive ? 'running' : 'pending'} variant="flow" />
                </Link>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Recent activity */}
      <Panel title="Recent Activity">
        {activityFeed.length === 0 ? (
          <p className="text-muted text-xs font-mono">No recent activity</p>
        ) : (
          <ul className="space-y-2">
            {activityFeed.map((item) => (
              <li key={item.id} className="text-xs font-mono border-b border-border pb-2 last:border-0">
                <span className="text-muted">
                  {new Date(item.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-foreground ml-2">{item.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
    </PageContentShell>
  )
}
