'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import {
  AlertTriangle,
  Download,
  Play,
  StopCircle,
  RefreshCw,
  Trash2,
  Clock,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusDot } from '@/components/ui/status-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { PhaseProgress } from '@/components/flow/phase-progress'
import { ReactTimeline } from '@/components/flow/timeline'
import { AgentChat } from '@/components/flow/agent-chat'
import { ApprovalsPanel } from '@/components/flow/approvals'
import { useAgentWebSocket } from '@/hooks/useAgentWebSocket'
import { flows } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import type { ApprovalRequest, Flow, WSMessage } from '@/types'

/**
 * Flow detail — the command center for a single pipeline.
 *
 *   ┌─ Header: name · status · project · controls ─────────────────┐
 *   │  Phase progress bar                                          │
 *   ├── Tabs: Timeline · Chat · Approvals · Artifacts · Report ────┤
 *   │  (tab content renders below)                                 │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Timeline + chat share one persistent WebSocket; approvals refetch via SWR
 * when new activity is detected or after a user action.
 */
export default function FlowDetailPage() {
  const params = useParams<{ id: string }>()
  const flowId = params?.id ?? ''

  const { data: flowData, isLoading, error, mutate: mutateFlow } = useSWR(
    flowId ? `/api/flows/${flowId}` : null,
    () => flows.get(flowId).then((r) => r.data as { flow: Flow; session_id?: string }),
    { refreshInterval: 10_000 },
  )
  const { data: approvalsData, mutate: mutateApprovals } = useSWR(
    flowId ? `/api/flows/${flowId}/approvals` : null,
    () => flows.listApprovals(flowId).then((r) => r.data as { approvals?: ApprovalRequest[] }),
    { refreshInterval: 15_000 },
  )

  const flow = flowData?.flow
  const sessionId = flowData?.session_id ?? flowId
  const approvals = approvalsData?.approvals ?? []
  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length

  // Stream — mount only once we know the flow exists, so we don't fire a
  // connection at `/ws/agent/undefined`.
  const { messages, connected, sendGuidance } = useAgentWebSocket({
    sessionId: flow ? sessionId : '',
    flowId: flow ? flowId : '',
    onMessage: React.useCallback(
      (m: WSMessage) => {
        if (m.type === 'phase_change' || m.type === 'approval_request') {
          void mutateFlow()
          void mutateApprovals()
        }
      },
      [mutateFlow, mutateApprovals],
    ),
  })

  if (isLoading) return <FlowSkeleton />
  if (error || !flow) return <FlowNotFound />

  return (
    <PageShell>
      <PageHeader
        backHref={flow.project_id ? `/projects/${flow.project_id}` : '/flows'}
        backLabel={flow.project_id ? 'Project' : 'Flows'}
        eyebrow="Flow"
        title={flow.name}
        subtitle={flow.objective || 'No objective set.'}
        actions={<FlowControls flow={flow} onMutate={mutateFlow} />}
      />

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <StatusStrip flow={flow} connected={connected} pendingApprovals={pendingApprovals} />

      {/* ── Phase progress ───────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardContent className="py-4">
          <PhaseProgress current={flow.phase} />
        </CardContent>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="timeline" className="mt-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="chat">Agent chat</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {pendingApprovals > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sev-high/20 text-sev-high text-[10px] font-mono px-1">
                {pendingApprovals}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="graph">Attack graph</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">ReAct stream</CardTitle>
              <span className="text-2xs font-mono uppercase tracking-widest text-fg-subtle">
                {messages.length} {messages.length === 1 ? 'event' : 'events'}
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[560px] pr-2">
                <ReactTimeline messages={messages} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat */}
        <TabsContent value="chat" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Live stream</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[460px] pr-2">
                  <ReactTimeline messages={messages} />
                </ScrollArea>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Operator guidance</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <AgentChat
                  connected={connected}
                  onSend={(t) => {
                    sendGuidance(t)
                    toast.success('Guidance sent')
                  }}
                  disabled={flow.status !== 'running' && flow.status !== 'paused'}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Approvals */}
        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardContent className="py-5">
              <ApprovalsPanel
                flowId={flowId}
                approvals={approvals}
                onAction={() => {
                  void mutateApprovals()
                  void mutateFlow()
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Graph — stub, real implementation in the EvoGraph milestone */}
        <TabsContent value="graph" className="mt-4">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
                  <Target className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-sm font-medium text-fg">Attack-chain graph</div>
                  <div className="mt-1 text-xs text-fg-muted max-w-md">
                    A force-directed visualisation of the EvoGraph attack chain ships
                    in the next milestone. For now you can pull the raw graph via
                    the API.
                  </div>
                </div>
                <Link
                  href="/evograph"
                  className="text-xs text-accent hover:underline underline-offset-4"
                >
                  Preview EvoGraph →
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report */}
        <TabsContent value="report" className="mt-4">
          <ReportPanel flow={flow} />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Status strip — at-a-glance flow state                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function StatusStrip({
  flow,
  connected,
  pendingApprovals,
}: {
  flow: Flow
  connected: boolean
  pendingApprovals: number
}) {
  const styles = STATUS_CLASSES[flow.status]
  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Cell
        label="Status"
        value={
          <div className="flex items-center gap-2">
            <StatusDot tone={flow.status === 'running' ? 'accent' : 'muted'} pulse={styles.pulse} size={6} />
            <Badge variant="outline" className={cn(styles.text, styles.border)}>
              {STATUS_LABEL[flow.status]}
            </Badge>
          </div>
        }
      />
      <Cell label="Phase" value={<span className="text-sm text-fg">{PHASE_LABEL[flow.phase]}</span>} />
      <Cell
        label="Stream"
        value={
          <div className="flex items-center gap-2">
            <StatusDot tone={connected ? 'accent' : 'danger'} pulse={connected} size={6} />
            <span className="text-xs text-fg-muted">
              {connected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
        }
      />
      <Cell
        label="Approvals"
        value={
          <div className="flex items-center gap-2">
            {pendingApprovals > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-sev-high" />
                <span className="text-xs text-sev-high">{pendingApprovals} pending</span>
              </>
            ) : (
              <span className="text-xs text-fg-muted">None pending</span>
            )}
          </div>
        }
      />
    </div>
  )
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle/40 px-4 py-3">
      <div className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">{label}</div>
      <div className="mt-1.5">{value}</div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Controls                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function FlowControls({ flow, onMutate }: { flow: Flow; onMutate: () => void }) {
  const [busy, setBusy] = React.useState<null | 'start' | 'cancel' | 'delete'>(null)
  const running = flow.status === 'running' || flow.status === 'pending'

  async function start() {
    if (busy) return
    setBusy('start')
    try {
      await flows.start(flow.id)
      toast.success('Flow started')
      onMutate()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not start flow', { description: e.response?.data?.error })
    } finally {
      setBusy(null)
    }
  }

  async function cancel() {
    if (busy) return
    if (!confirm('Cancel this flow? Any in-progress work will be interrupted.')) return
    setBusy('cancel')
    try {
      await flows.cancel(flow.id)
      toast.success('Flow cancelled')
      onMutate()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not cancel flow', { description: e.response?.data?.error })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (busy) return
    if (!confirm('Delete this flow and all associated data?')) return
    setBusy('delete')
    try {
      await flows.delete(flow.id)
      toast.success('Flow deleted')
      window.location.href = flow.project_id ? `/projects/${flow.project_id}` : '/flows'
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not delete flow', { description: e.response?.data?.error })
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="md"
        onClick={onMutate}
        leftIcon={<RefreshCw />}
        disabled={busy !== null}
      >
        Refresh
      </Button>
      {!running ? (
        <Button
          variant="primary"
          size="md"
          onClick={start}
          loading={busy === 'start'}
          disabled={busy !== null}
          leftIcon={<Play />}
        >
          Start
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="md"
          onClick={cancel}
          loading={busy === 'cancel'}
          disabled={busy !== null}
          leftIcon={<StopCircle />}
          className="text-sev-critical hover:text-sev-critical"
        >
          Cancel
        </Button>
      )}
      <Button
        variant="ghost"
        size="md"
        onClick={remove}
        loading={busy === 'delete'}
        disabled={busy !== null}
        leftIcon={<Trash2 />}
        className="text-sev-critical hover:text-sev-critical hover:bg-sev-critical/10"
      >
        Delete
      </Button>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Report                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function ReportPanel({ flow }: { flow: Flow }) {
  const [busy, setBusy] = React.useState<null | 'md' | 'json'>(null)

  async function download(format: 'markdown' | 'json') {
    const kind = format === 'markdown' ? 'md' : 'json'
    setBusy(kind)
    try {
      if (format === 'markdown') {
        const res = await flows.reportDownload(flow.id, 'markdown')
        triggerDownload(res.data as Blob, `${flow.name}.md`)
      } else {
        const res = await flows.report(flow.id, 'json')
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        triggerDownload(blob, `${flow.name}.json`)
      }
      toast.success(`Downloaded ${format}`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Report unavailable', {
        description: e.response?.data?.error ?? 'The report is generated when the flow completes.',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Engagement report</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <MetaRow label="Started" icon={Clock} value={formatDateTime(flow.started_at)} />
            <MetaRow label="Completed" icon={Clock} value={flow.completed_at ? formatDateTime(flow.completed_at) : '—'} />
            <MetaRow label="Last update" icon={Clock} value={`${timeAgo(flow.updated_at)} · ${formatDateTime(flow.updated_at)}`} />
            <MetaRow label="Attack path" icon={Target} value={flow.attack_path || '—'} />
          </dl>
          <Separator />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => download('markdown')}
              loading={busy === 'md'}
              disabled={busy !== null}
              leftIcon={<Download />}
            >
              Download Markdown
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => download('json')}
              loading={busy === 'json'}
              disabled={busy !== null}
              leftIcon={<Download />}
            >
              Download JSON
            </Button>
          </div>
          <div className="text-2xs text-fg-subtle">
            Reports include MITRE ATT&amp;CK mapping, CVSS scoring, and a remediation
            roadmap. They&apos;re available after the flow reaches the reporting phase.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetaRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Icon className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
      <div className="min-w-0">
        <div className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">{label}</div>
        <div className="mt-0.5 text-xs text-fg truncate">{value}</div>
      </div>
    </div>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Loading / not found                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function FlowSkeleton() {
  return (
    <PageShell>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-80 mt-4" />
      <Skeleton className="h-4 w-96 mt-2" />
      <div className="mt-6 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-24 w-full mt-4" />
      <Skeleton className="h-[400px] w-full mt-4" />
    </PageShell>
  )
}

function FlowNotFound() {
  return (
    <PageShell>
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-5 w-5 text-sev-critical" />
            <div className="text-sm font-medium text-fg">Flow not found</div>
            <div className="text-xs text-fg-muted">
              It may have been deleted or you may not have access.
            </div>
            <Link href="/flows">
              <Button variant="secondary" size="sm">Back to flows</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  )
}
