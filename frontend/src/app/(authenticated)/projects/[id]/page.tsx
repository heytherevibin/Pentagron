'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { projects as projectsApi, flows as flowsApi } from '@/lib/api'
import type { Project, Flow } from '@/types'
import { Panel } from '@/components/ui/Panel'
import { DataLabel } from '@/components/ui/DataLabel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProjectDetailPageSkeleton } from '@/components/ui/Skeleton'
import { PageContentShell } from '@/components/layout/PageContentShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(str: string, max: number): string {
  if (!str) return '--'
  return str.length > max ? str.slice(0, max) + '...' : str
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [flowList, setFlowList] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', objective: '' })
  const [creating, setCreating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [pRes, fRes] = await Promise.all([
        projectsApi.get(id),
        flowsApi.list(id),
      ])
      const pData = pRes.data?.data ?? pRes.data
      const fData = fRes.data?.data ?? fRes.data
      setProject(pData)
      setFlowList(Array.isArray(fData) ? fData : fData?.flows ?? [])
    } catch {
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreateFlow(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return

    setCreating(true)
    try {
      await flowsApi.create(id, {
        name: formData.name.trim(),
        objective: formData.objective.trim(),
      })
      toast.success('Flow created')
      setShowForm(false)
      setFormData({ name: '', objective: '' })
      load()
    } catch {
      toast.error('Failed to create flow')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <ProjectDetailPageSkeleton />
  }

  const projectName = project?.name ?? 'Project'

  return (
    <PageContentShell>
      <div className="animate-fade-in space-y-6">
        {/* Breadcrumb + page title — matches flow page and dashboard */}
        <nav className="flex items-center gap-1.5 text-xs font-mono text-muted">
          <Link href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{projectName}</span>
        </nav>
        <div>
          <h1 className="page-title">{projectName}</h1>
          <p className="page-subtitle">Engagement overview</p>
        </div>

        <Panel title="PROJECT INFO">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <DataLabel>SCOPE</DataLabel>
              <p className="text-sm font-mono text-foreground break-words">
                {project?.scope || '—'}
              </p>
            </div>
            <div className="space-y-1">
              <DataLabel>CREATED</DataLabel>
              <p className="text-sm font-mono text-foreground">
                {project?.created_at ? formatDate(project.created_at) : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <DataLabel>FLOWS</DataLabel>
              <p className="text-sm font-mono text-foreground">
                {flowList.length}
              </p>
            </div>
          </div>
        </Panel>

        {/* Engagement Flows */}
        <Panel
          title="ENGAGEMENT FLOWS"
          headerRight={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm((prev) => !prev)}
            >
              {showForm ? 'Cancel' : '+ New Flow'}
            </Button>
          }
        >
          {/* Inline create form */}
          {showForm && (
            <form onSubmit={handleCreateFlow} className="mb-4 p-4 bg-surface-2 border border-border">
              <div className="space-y-4">
                <Input
                  label="FLOW NAME"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="Q1 External Assessment"
                />
                <Textarea
                  label="OBJECTIVE"
                  rows={3}
                  value={formData.objective}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, objective: e.target.value }))
                  }
                  placeholder="Identify external attack surface and exploitable vulnerabilities..."
                />
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowForm(false)
                      setFormData({ name: '', objective: '' })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={creating}
                  >
                    Create Flow
                  </Button>
                </div>
              </div>
            </form>
          )}

          {flowList.length === 0 ? (
            <EmptyState
              title="No flows initialized"
              description="Create an engagement flow to begin autonomous pentesting"
              action={
                !showForm ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowForm(true)}
                  >
                    + New Flow
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div>
              <div className="grid grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,1.5fr)_auto] gap-3 px-4 py-2.5 border-b border-border">
                <span className="panel-header-text">Flow</span>
                <span className="panel-header-text">Status</span>
                <span className="panel-header-text">Phase</span>
                <span className="panel-header-text">Objective</span>
                <span className="panel-header-text">Created</span>
              </div>
              {flowList.map((flow) => (
                <Link
                  key={flow.id}
                  href={`/flows/${flow.id}`}
                  className="grid grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,1.5fr)_auto] gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer items-center"
                >
                  <span className="text-sm font-mono text-foreground truncate">
                    {flow.name}
                  </span>
                  <StatusBadge variant="flow" status={flow.status} />
                  <span className="text-[10px] font-mono uppercase text-muted tracking-wider whitespace-nowrap">
                    {flow.phase?.replace(/_/g, ' ') ?? '—'}
                  </span>
                  <span className="text-xs font-mono text-muted truncate">
                    {truncate(flow.objective ?? '', 50)}
                  </span>
                  <span className="text-[10px] font-mono text-muted whitespace-nowrap">
                    {formatTimestamp(flow.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* Delete Confirm Dialog */}
        <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="DELETE FLOW"
        description="This will permanently destroy the flow and all associated data. This action cannot be undone."
        variant="danger"
        confirmLabel="DELETE"
        onConfirm={() => {
          setDeleteOpen(false)
          setDeleteTarget(null)
        }}
        />
      </div>
    </PageContentShell>
  )
}
