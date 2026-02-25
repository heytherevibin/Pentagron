'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { projects as projectsApi } from '@/lib/api'
import type { Project } from '@/types'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { DataLabel } from '@/components/ui/DataLabel'
import { GlowDot } from '@/components/ui/GlowDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardPage() {
  const [projectList, setProjectList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    projectsApi
      .list()
      .then((res) => {
        const data = res.data
        const list = Array.isArray(data) ? data : data?.data ?? data?.projects ?? []
        setProjectList(list)
      })
      .catch(() => {
        setProjectList([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Stat skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="stat" />
          ))}
        </div>
        {/* Table skeleton */}
        <Skeleton variant="card" className="h-48" />
        {/* Activity skeleton */}
        <Skeleton variant="card" className="h-32" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="PROJECTS" value={projectList.length} accent="emerald" />
        <StatCard label="ACTIVE FLOWS" value={0} accent="blue" />
        <StatCard label="PENDING APPROVALS" value={0} accent="amber" />
        <StatCard label="FINDINGS" value={0} accent="crimson" />
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
            {projectList.map((project) => (
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
                  --
                </span>
                <span className="flex items-center gap-1.5">
                  <GlowDot status="ok" size="sm" />
                  <span className="text-xxs font-mono uppercase text-mc-text-muted">
                    ACTIVE
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      {/* Recent activity */}
      <Panel title="RECENT ACTIVITY">
        <p className="text-mc-text-muted text-xs font-mono">
          activity feed coming soon
        </p>
      </Panel>
    </div>
  )
}
