'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { flows as flowsApi } from '@/lib/api'
import { GlowDot } from '@/components/ui/GlowDot'
import { DataLabel } from '@/components/ui/DataLabel'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PhaseProgress } from '@/components/ui/PhaseProgress'
import { FlowDetailPageSkeleton } from '@/components/ui/Skeleton'
import { PageContentShell } from '@/components/layout/PageContentShell'
import AgentChat from '@/components/AgentChat'
import GraphVisualization from '@/components/GraphVisualization'
import ApprovalDialog from '@/components/ApprovalDialog'
import type { Flow, FlowStatus, ApprovalRequest, GraphNode, GraphEdge } from '@/types'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatTimestamp(ts?: string | null): string {
  if (!ts) return '\u2014'
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return ts
  }
}

function statusToGlow(
  status?: FlowStatus,
): 'ok' | 'warning' | 'error' | 'offline' {
  if (!status) return 'offline'
  if (status === 'running') return 'ok'
  if (status === 'paused') return 'warning'
  if (status === 'failed' || status === 'cancelled') return 'error'
  return 'offline'
}

export default function FlowPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [flow, setFlow] = useState<Flow | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [flowRes, approvalRes, graphRes] = await Promise.all([
        flowsApi.get(id),
        flowsApi.listApprovals(id),
        flowsApi.graph(id).catch(() => ({ data: { nodes: [], edges: [] } })),
      ])
      setFlow(flowRes.data)
      setApprovals(approvalRes.data)
      setGraphNodes(graphRes.data?.nodes ?? [])
      setGraphEdges(graphRes.data?.edges ?? [])
    } catch {
      toast.error('Failed to load flow data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const shouldPoll =
      flow?.status === 'running' ||
      flow?.status === 'paused'

    if (shouldPoll) {
      pollRef.current = setInterval(fetchData, 5000)
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [flow?.status, fetchData])

  const handleStart = async () => {
    try {
      await flowsApi.start(id)
      toast.success('Flow started')
      fetchData()
    } catch {
      toast.error('Failed to start flow')
    }
  }

  const handleCancel = async () => {
    try {
      await flowsApi.cancel(id)
      toast.success('Flow cancelled')
      fetchData()
    } catch {
      toast.error('Failed to cancel flow')
    }
  }

  const handleApprove = async (approvalId: string, notes?: string) => {
    try {
<<<<<<< HEAD
      await flowsApi.approve(id, approvalId, notes);
      toast.success('Phase transition approved');
      fetchData();
=======
      await flowsApi.approve(id, approvalId, notes)
      fetchData()
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
    } catch {
      toast.error('Approval failed')
    }
  }

  const handleReject = async (approvalId: string, notes?: string) => {
    try {
<<<<<<< HEAD
      await flowsApi.reject(id, approvalId, notes);
      toast.success('Phase transition rejected');
      fetchData();
=======
      await flowsApi.reject(id, approvalId, notes)
      fetchData()
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
    } catch {
      toast.error('Rejection failed')
    }
  }

  const pendingApproval =
    approvals.find((a) => a.status === 'pending') ?? null

  const prevPendingRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingApproval) {
      prevPendingRef.current = null
      return
    }
    if (pendingApproval.id === prevPendingRef.current) return
    prevPendingRef.current = pendingApproval.id

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      new Notification('PENTAGRON — Approval Required', {
        body: `Phase transition needs authorization: ${pendingApproval.phase ?? 'unknown'}`,
        icon: '/icons/icon-192x192.svg',
      })
    }
  }, [pendingApproval])

  if (loading) {
    return <FlowDetailPageSkeleton />
  }

  const flowName = flow?.name ?? id
  const phaseOrder = ['recon', 'analysis', 'exploitation', 'post_exploitation', 'reporting'] as const

  return (
    <PageContentShell variant="fullHeight" fullWidth innerClassName="page-inner-no-padding">
      {/* Header — single row: breadcrumb + flow title, then status + actions */}
      <header className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <nav className="flex items-center gap-1.5 text-xs font-mono text-muted min-w-0">
            <Link href="/" className="hover:text-foreground transition-colors truncate">
              Dashboard
            </Link>
            <span aria-hidden>/</span>
            {flow?.project_id && (
              <>
                <Link
                  href={`/projects/${flow.project_id}`}
                  className="hover:text-foreground transition-colors truncate"
                >
                  Project
                </Link>
                <span aria-hidden>/</span>
              </>
            )}
            <span className="text-foreground font-medium truncate">{flowName}</span>
          </nav>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <GlowDot status={statusToGlow(flow?.status)} />
            <StatusBadge status={flow?.status ?? 'pending'} />
            {flow?.status === 'pending' && (
              <Button onClick={handleStart} size="sm">
                Start
              </Button>
            )}
            {(flow?.status === 'running' || flow?.status === 'paused') && (
              <Button onClick={handleCancel} variant="danger" size="sm">
                Cancel
              </Button>
            )}
            {(flow?.status === 'completed' || flow?.status === 'failed') && (
              <>
                <Button
                  onClick={async () => {
                    if (!flow) return
                    try {
                      const res = await flowsApi.reportDownload(id)
                      const blob = new Blob([res.data], { type: 'text/markdown' })
                      const safeName = (flow.name ?? flow.id).replace(/[^a-zA-Z0-9_-]/g, '_')
                      downloadBlob(blob, `pentagron-report-${safeName}.md`)
                      toast.success('Report exported')
                    } catch {
                      toast.error('Failed to export report')
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  Export MD
                </Button>
                <Button
                  onClick={async () => {
                    if (!flow) return
                    try {
                      const res = await flowsApi.reportDownload(id, 'pdf')
                      const blob = new Blob([res.data], { type: 'application/pdf' })
                      const safeName = (flow.name ?? flow.id).replace(/[^a-zA-Z0-9_-]/g, '_')
                      downloadBlob(blob, `pentagron-report-${safeName}.pdf`)
                      toast.success('PDF report exported')
                    } catch {
                      toast.error('Failed to export PDF report')
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  Export PDF
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-2">
          <PhaseProgress currentPhase={flow?.phase ?? 'recon'} status={flow?.status ?? 'pending'} />
        </div>
      </header>

      {/* 3-panel mission control: Agent Activity | Telemetry | EvoGraph */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <section className="flex-1 lg:w-1/2 min-h-[360px] lg:min-h-0 flex flex-col overflow-hidden">
          <Panel
            title="AGENT ACTIVITY"
            className="flex-1 flex flex-col min-h-0 border-r border-border rounded-none"
            contentClassName="flex-1 min-h-0 p-0 overflow-hidden"
          >
            <AgentChat flowId={id} />
          </Panel>
        </section>

        <section className="lg:w-[280px] xl:w-[320px] shrink-0 border-r border-border overflow-y-auto flex flex-col">
          <Panel title="TELEMETRY" className="h-full flex flex-col rounded-none">
            <div className="space-y-4">
              <div>
                <DataLabel>PHASE</DataLabel>
                <ul className="mt-1.5 space-y-0.5">
                  {[
                    { key: 'recon', label: 'Reconnaissance' },
                    { key: 'analysis', label: 'Analysis' },
                    { key: 'exploitation', label: 'Exploitation' },
                    { key: 'post_exploitation', label: 'Post-Exploitation' },
                    { key: 'reporting', label: 'Reporting' },
                  ].map(({ key, label }) => {
                    const current = (flow?.phase ?? 'recon') === key
                    const currentIdx = phaseOrder.indexOf(flow?.phase ?? 'recon')
                    const thisIdx = phaseOrder.indexOf(key)
                    const done = flow?.status === 'completed' || thisIdx < currentIdx
                    return (
                      <li
                        key={key}
                        className={`text-xs font-mono py-0.5 pl-2 border-l-2 ${
                          current
                            ? 'border-accent text-foreground font-medium'
                            : done
                              ? 'border-surface-3 text-muted'
                              : 'border-surface-3 text-muted/70'
                        }`}
                      >
                        {current ? '▸ ' : done ? '✓ ' : '· '}
                        {label}
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <DataLabel>CURRENT</DataLabel>
                  <p className="text-xs font-mono text-foreground">{flow?.phase ?? '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <DataLabel>PATH</DataLabel>
                  <p className="text-xs font-mono text-foreground truncate" title={flow?.attack_path ?? ''}>
                    {flow?.attack_path ?? 'unclassified'}
                  </p>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <DataLabel>STARTED</DataLabel>
                  <p className="text-xs font-mono text-foreground">{formatTimestamp(flow?.started_at)}</p>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <DataLabel>ENDED</DataLabel>
                  <p className="text-xs font-mono text-foreground">{formatTimestamp(flow?.completed_at)}</p>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <DataLabel>STATUS</DataLabel>
                  <StatusBadge status={flow?.status ?? 'pending'} />
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="lg:w-[280px] xl:w-[320px] shrink-0 flex flex-col overflow-auto">
          <Panel title="EVOGRAPH" className="flex-1 flex flex-col min-h-0 rounded-none">
            <div className="flex-1 min-h-[400px] p-2 flex items-center justify-center">
              <GraphVisualization
                nodes={graphNodes}
                edges={graphEdges}
                width={280}
                height={400}
              />
            </div>
          </Panel>
        </section>
      </main>

      {/* Approval Dialog */}
      <ApprovalDialog
        approval={pendingApproval}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </PageContentShell>
  )
}
