'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ProjectOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { projects as projectsApi, activity as activityApi } from '@/lib/api'
import type { Project } from '@/types'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
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
}

export default function DashboardPage() {
  const [projectList, setProjectList] = useState<Project[]>([])
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
  }, [])

  if (loading) {
    return <DashboardPageSkeleton />
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
          </div>
        )}
      </Panel>

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
        )}
      </Panel>
    </div>
    </PageContentShell>
  )
}
