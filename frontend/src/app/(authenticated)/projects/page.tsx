'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowUpRight, FolderKanban, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { projects } from '@/lib/api'
import { timeAgo, truncate } from '@/lib/utils'
import type { Project } from '@/types'

/**
 * Projects list — grid of engagement cards with a live filter. Each card
 * links to its detail page (`/projects/[id]`).
 */
export default function ProjectsPage() {
  const { data, isLoading } = useSWR(
    '/api/projects',
    () => projects.list().then((r) => r.data as Project[]),
    { refreshInterval: 30_000 },
  )
  const [query, setQuery] = React.useState('')

  const all = React.useMemo(() => data ?? [], [data])
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.scope.toLowerCase().includes(q),
    )
  }, [all, query])

  return (
    <PageShell>
      <PageHeader
        eyebrow="Engagements"
        title="Projects"
        subtitle={`${all.length} ${all.length === 1 ? 'project' : 'projects'} · filter below to narrow`}
        actions={
          <Link href="/projects/new">
            <Button variant="primary" size="md" leftIcon={<Plus />}>
              New project
            </Button>
          </Link>
        }
      />

      {/* Filter bar */}
      <div className="mt-6 flex items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, scope, description…"
          leftSlot={<Search />}
          containerClassName="max-w-md"
          size="md"
          aria-label="Filter projects"
        />
      </div>

      {/* Grid */}
      <div className="mt-6">
        {isLoading ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyProjects hasQuery={query.length > 0} />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="group block rounded-lg border border-border bg-bg-subtle/30 p-4 hover:bg-bg-subtle/60 hover:border-border-strong transition-colors duration-120"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium text-fg truncate">{project.name}</div>
            <div className="mt-1 text-xs text-fg-muted line-clamp-2">
              {project.description || 'No description'}
            </div>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle group-hover:text-fg transition-colors duration-120 shrink-0" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-2xs text-fg-subtle font-mono truncate max-w-[60%]">
            {truncate(project.scope || '—', 40)}
          </div>
          <div className="text-2xs text-fg-subtle font-mono uppercase tracking-widest">
            {timeAgo(project.updated_at)}
          </div>
        </div>
      </Link>
    </li>
  )
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="rounded-lg border border-border bg-bg-subtle/30 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full mt-3" />
          <Skeleton className="h-3 w-1/2 mt-2" />
          <div className="mt-6 flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyProjects({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
            <FolderKanban className="h-4 w-4 text-fg-subtle" />
          </div>
          <div>
            <div className="text-sm font-medium text-fg">
              {hasQuery ? 'No projects match your filter.' : 'No projects yet.'}
            </div>
            <div className="mt-1 text-xs text-fg-muted max-w-sm">
              {hasQuery
                ? 'Try a different keyword, or create a new project from scratch.'
                : 'Projects scope an engagement — targets, objectives, credentials. Create one to get started.'}
            </div>
          </div>
          <Link href="/projects/new">
            <Button variant="primary" size="sm" leftIcon={<Plus />}>
              New project
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
