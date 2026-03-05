'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { projects as projectsApi, flows as flowsApi, activity as activityApi } from '@/lib/api'
import type { Project, Flow } from '@/types'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { DataLabel } from '@/components/ui/DataLabel'
import { GlowDot } from '@/components/ui/GlowDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'

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
  }, [])

  const activeFlows = allFlows.filter((f) => f.status === 'running' || f.status === 'paused').length
  const pendingApprovals = allFlows.filter((f) => f.status === 'paused').length

  // Count flows per project for the table
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
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="PROJECTS" value={projectList.length} accent="emerald" />
        <StatCard label="ACTIVE FLOWS" value={activeFlows} accent="blue" />
        <StatCard label="PENDING APPROVALS" value={pendingApprovals} accent="amber" />
        <StatCard label="TOTAL FLOWS" value={allFlows.length} accent="crimson" />
      </div>

      {/* Active engagements */}
      <Panel
        title="ACTIVE ENGAGEMENTS"
        headerRight={
          <Link href="/projects/new">
            <Button variant="outline" size="sm">
              &#8862; NEW PROJECT
            </Button>
          </Link>
        }
      >
        {projectList.length === 0 ? (
          <EmptyState
            title="NO ACTIVE ENGAGEMENTS"
            description="initialize your first project to begin autonomous pentesting"
            action={
              <Link href="/projects/new">
                <Button variant="primary">NEW PROJECT</Button>
              </Link>
            }
          />
        ) : (
          <div>
            {/* Header row */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-3 py-2 border-b border-mc-border">
              <DataLabel>NAME</DataLabel>
              <DataLabel>SCOPE</DataLabel>
              <DataLabel>FLOWS</DataLabel>
              <DataLabel>STATUS</DataLabel>
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
          </div>
        )}
      </Panel>

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
        )}
      </Panel>
    </div>
  )
}
