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
import { PhaseProgress } from '@/components/ui/PhaseProgress'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
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

  // Delete confirmation state (future use)
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
      setFlowList(Array.isArray(fData) ? fData : [])
    } catch {
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleDeleteFlow() {
    if (!deleteTarget) return
    try {
      await flowsApi.delete(deleteTarget)
      toast.success('Flow deleted')
      setFlowList((prev) => prev.filter((f) => f.id !== deleteTarget))
    } catch {
      toast.error('Failed to delete flow')
    } finally {
      setDeleteOpen(false)
      setDeleteTarget(null)
    }
  }

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

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="card" className="h-16" />
        <Skeleton variant="card" className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Project Info ─────────────────────────────────────────────── */}
      <Panel title={project?.name ?? 'PROJECT'}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <DataLabel>SCOPE</DataLabel>
            <span className="text-sm font-mono text-mc-text-dim">
              {project?.scope || '--'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DataLabel>CREATED</DataLabel>
            <span className="text-sm font-mono text-mc-text-dim">
              {project?.created_at ? formatDate(project.created_at) : '--'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DataLabel>OWNER</DataLabel>
            <span className="text-sm font-mono text-mc-text-dim">
              {project?.owner_id || '--'}
            </span>
          </div>
        </div>
      </Panel>

      {/* ── Engagement Flows ─────────────────────────────────────────── */}
      <Panel
        title="ENGAGEMENT FLOWS"
        headerRight={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? 'CANCEL' : '+ NEW FLOW'}
          </Button>
        }
      >
        {/* Inline create form */}
        {showForm && (
          <form onSubmit={handleCreateFlow} className="mb-4">
            <Panel variant="inset">
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
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-mc-border">
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
            </Panel>
          </form>
        )}

        {/* Flow list */}
        {flowList.length === 0 ? (
          <EmptyState
            title="NO FLOWS INITIALIZED"
            description="create an engagement flow to begin autonomous pentesting"
            action={
              !showForm ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowForm(true)}
                >
                  + NEW FLOW
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_2fr_1.5fr_1fr_auto] gap-3 px-3 py-2 border-b border-mc-border">
              <DataLabel>FLOW</DataLabel>
              <DataLabel>STATUS</DataLabel>
              <DataLabel>PHASE</DataLabel>
              <DataLabel>OBJECTIVE</DataLabel>
              <DataLabel>PROGRESS</DataLabel>
              <DataLabel>TIME</DataLabel>
              <DataLabel></DataLabel>
            </div>

            {/* Flow rows */}
            {flowList.map((flow) => (
              <div
                key={flow.id}
                className="grid grid-cols-[2fr_1fr_1fr_2fr_1.5fr_1fr_auto] gap-3 px-3 py-3 border-b border-mc-border last:border-b-0 hover:bg-mc-surface-hover transition-colors items-center"
              >
                <Link href={`/flows/${flow.id}`} className="contents">
                  <span className="text-sm font-mono text-mc-text truncate">
                    {flow.name}
                  </span>
                  <StatusBadge variant="flow" status={flow.status} />
                  <span className="text-xxs font-mono uppercase text-mc-text-dim tracking-wider">
                    {flow.phase?.replace(/_/g, ' ') ?? '--'}
                  </span>
                  <span className="text-xs font-mono text-mc-text-dim truncate">
                    {truncate(flow.objective, 40)}
                  </span>
                  <PhaseProgress
                    currentPhase={flow.phase ?? 'recon'}
                    status={flow.status}
                    compact
                  />
                  <span className="text-xxs font-mono text-mc-text-ghost">
                    {formatTimestamp(flow.created_at)}
                  </span>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setDeleteTarget(flow.id)
                    setDeleteOpen(true)
                  }}
                  className="text-mc-text-ghost hover:text-mc-crimson transition-colors text-xs font-mono px-1"
                  title="Delete flow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Delete Confirm Dialog ───────────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="DELETE FLOW"
        description="This will permanently destroy the flow and all associated data. This action cannot be undone."
        variant="danger"
        confirmLabel="DELETE"
        onConfirm={handleDeleteFlow}
      />
    </div>
  )
}
