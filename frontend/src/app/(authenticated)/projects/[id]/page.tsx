'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowUpRight,
  Copy,
  Check,
  Trash2,
  Workflow,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/ui/status-dot'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { projects, flows as flowsApi } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import type { Flow, Project } from '@/types'

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const { data: projectData, isLoading: projectLoading, error: projectError } = useSWR(
    id ? `/api/projects/${id}` : null,
    () => projects.get(id!).then((r) => r.data as { project: Project }),
  )
  const { data: flowsData, isLoading: flowsLoading, mutate: mutateFlows } = useSWR(
    id ? `/api/projects/${id}/flows` : null,
    () => flowsApi.list(id!).then((r) => r.data as { flows?: Flow[] }),
    { refreshInterval: 15_000 },
  )

  const project = projectData?.project
  const flows = flowsData?.flows ?? []

  async function handleDelete() {
    if (!id) return
    if (!confirm('Delete this project? All associated flows will be orphaned.')) return
    try {
      await projects.delete(id)
      toast.success('Project deleted')
      router.replace('/projects')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not delete project', { description: e.response?.data?.error ?? 'Try again.' })
    }
  }

  if (projectLoading) {
    return (
      <PageShell>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64 mt-4" />
        <Skeleton className="h-4 w-96 mt-2" />
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    )
  }

  if (projectError || !project) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-5 w-5 text-sev-critical" />
              <div className="text-sm font-medium text-fg">Project not found</div>
              <div className="text-xs text-fg-muted">
                It may have been deleted or you may not have access.
              </div>
              <Link href="/projects">
                <Button variant="secondary" size="sm">Back to projects</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        backHref="/projects"
        backLabel="All projects"
        eyebrow="Project"
        title={project.name}
        subtitle={project.description || 'No description provided.'}
        actions={
          <div className="flex items-center gap-2">
            <NewFlowDialog
              projectId={project.id}
              onCreated={() => mutateFlows()}
            />
            <Button
              variant="ghost"
              size="md"
              onClick={handleDelete}
              leftIcon={<Trash2 />}
              className="text-sev-critical hover:text-sev-critical hover:bg-sev-critical/10"
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        {/* Flows list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="h-3.5 w-3.5 text-accent" />
              Flows
              <span className="text-2xs text-fg-subtle font-mono">· {flows.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {flowsLoading ? (
              <FlowsSkeleton />
            ) : flows.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <div className="text-sm font-medium text-fg">No flows yet</div>
                <div className="mt-1 text-xs text-fg-muted max-w-sm mx-auto">
                  Launch a flow to begin reconnaissance. Each flow runs the five-phase
                  pipeline with human approval gates.
                </div>
                <div className="mt-4">
                  <NewFlowDialog projectId={project.id} onCreated={() => mutateFlows()} />
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {flows.map((f) => (
                  <FlowRow key={f.id} flow={f} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Metadata side panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Scope</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScopeBlock scope={project.scope} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="flex flex-col gap-2.5 text-xs">
                <MetaRow label="ID" value={<code className="font-mono text-2xs text-fg-muted">{project.id}</code>} />
                <Separator />
                <MetaRow label="Created" value={formatDateTime(project.created_at)} />
                <MetaRow label="Updated" value={`${timeAgo(project.updated_at)} · ${formatDateTime(project.updated_at)}`} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

function FlowRow({ flow }: { flow: Flow }) {
  const styles = STATUS_CLASSES[flow.status]
  return (
    <li>
      <Link
        href={`/flows/${flow.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-subtle/60 transition-colors duration-120"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', styles.border, styles.bg)}>
            <StatusDot tone={flow.status === 'running' ? 'accent' : 'muted'} pulse={styles.pulse} size={6} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-fg truncate">{flow.name}</div>
            <div className="mt-0.5 text-2xs text-fg-subtle font-mono truncate">
              {flow.objective || 'No objective'} · {PHASE_LABEL[flow.phase]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-2xs text-fg-subtle font-mono">{timeAgo(flow.updated_at)}</span>
          <Badge variant="outline" className={cn(styles.text, styles.border)}>
            {STATUS_LABEL[flow.status]}
          </Badge>
          <ArrowUpRight className="h-3 w-3 text-fg-subtle" />
        </div>
      </Link>
    </li>
  )
}

function FlowsSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border-subtle">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1"><Skeleton className="h-3 w-48" /><Skeleton className="h-2.5 w-32 mt-2" /></div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function ScopeBlock({ scope }: { scope: string }) {
  const [copied, setCopied] = React.useState(false)
  const lines = (scope ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  async function onCopy() {
    if (!scope) return
    try {
      await navigator.clipboard.writeText(scope)
      setCopied(true)
      toast.success('Scope copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }

  if (lines.length === 0) {
    return <div className="text-xs text-fg-subtle">No scope defined.</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs text-fg-subtle font-mono uppercase tracking-widest">
          {lines.length} {lines.length === 1 ? 'target' : 'targets'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-2xs font-mono text-fg-subtle hover:text-fg transition-colors duration-120"
        >
          {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <ul className="flex flex-col gap-1 rounded-md border border-border bg-bg-muted/60 px-3 py-2.5 max-h-64 overflow-y-auto">
        {lines.map((line, i) => (
          <li key={i} className="text-xs font-mono text-fg truncate">
            <span className="text-accent/80 select-none pr-1">·</span>
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dt className="text-2xs text-fg-subtle font-mono uppercase tracking-widest shrink-0">{label}</dt>
      <dd className="text-xs text-fg-muted text-right truncate min-w-0">{value}</dd>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   New-flow dialog                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function NewFlowDialog({
  projectId,
  onCreated,
}: {
  projectId: string
  onCreated: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [objective, setObjective] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const { data } = await flowsApi.create(projectId, {
        name: name.trim(),
        objective: objective.trim(),
      })
      const created = (data as { flow?: { id: string } }).flow
      toast.success('Flow created', { description: name })
      setOpen(false)
      setName('')
      setObjective('')
      onCreated()
      if (created?.id) router.push(`/flows/${created.id}`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setError(e.response?.data?.error ?? e.message ?? 'Could not create flow.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="md" leftIcon={<Plus />}>
          New flow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New flow</DialogTitle>
          <DialogDescription>
            Spin up a five-phase pipeline. You&apos;ll approve phase gates before each
            exploitation step runs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && (
            <div className="flex items-start gap-2.5 rounded-md border border-sev-critical/30 bg-sev-critical/5 px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-sev-critical mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed text-sev-critical/90">{error}</div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-name" hint="required">Name</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recon · external surface"
              size="md"
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-obj" hint="required">Objective</Label>
            <Textarea
              id="flow-obj"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Find the weakest exposed service on *.example.com and prove exploitability."
              rows={3}
              disabled={loading}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading || !name.trim() || !objective.trim()}
            >
              Create flow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
