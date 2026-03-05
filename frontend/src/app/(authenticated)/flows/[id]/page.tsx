'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { flows as flowsApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { GlowDot } from '@/components/ui/GlowDot';
import { DataLabel } from '@/components/ui/DataLabel';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PhaseProgress } from '@/components/ui/PhaseProgress';
import { Skeleton } from '@/components/ui/Skeleton';
import AgentChat from '@/components/AgentChat';
import GraphVisualization from '@/components/GraphVisualization';
import ApprovalDialog from '@/components/ApprovalDialog';
import type { Flow, FlowStatus, ApprovalRequest, GraphNode, GraphEdge } from '@/types';

/* ─── report download ─── */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── helpers ─── */
function formatTimestamp(ts?: string | null): string {
  if (!ts) return '\u2014';
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function statusToGlow(
  status?: FlowStatus,
): 'ok' | 'warning' | 'error' | 'offline' {
  if (!status) return 'offline';
  if (status === 'running') return 'ok';
  if (status === 'paused') return 'warning';
  if (status === 'failed' || status === 'cancelled') return 'error';
  return 'offline';
}

/* ═══════════════════════════════════════════════
   FLOW PAGE — MISSION CONTROL SCREEN
   ═══════════════════════════════════════════════ */
export default function FlowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── data fetcher ── */
  const fetchData = useCallback(async () => {
    try {
      const [flowRes, approvalRes, graphRes] = await Promise.all([
        flowsApi.get(id),
        flowsApi.listApprovals(id),
        flowsApi.graph(id).catch(() => ({ data: { nodes: [], edges: [] } })),
      ]);
      setFlow(flowRes.data);
      setApprovals(approvalRes.data);
      setGraphNodes(graphRes.data?.nodes ?? []);
      setGraphEdges(graphRes.data?.edges ?? []);
    } catch {
      toast.error('Failed to load flow data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* initial load */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* poll every 5s while running or paused */
  useEffect(() => {
    const shouldPoll =
      flow?.status === 'running' ||
      flow?.status === 'paused';

    if (shouldPoll) {
      pollRef.current = setInterval(fetchData, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [flow?.status, fetchData]);

  /* ── flow actions ── */
  const handleStart = async () => {
    try {
      await flowsApi.start(id);
      toast.success('Flow started');
      fetchData();
    } catch {
      toast.error('Failed to start flow');
    }
  };

  const handleCancel = async () => {
    try {
      await flowsApi.cancel(id);
      toast.success('Flow cancelled');
      fetchData();
    } catch {
      toast.error('Failed to cancel flow');
    }
  };

  /* ── approval actions ── */
  const handleApprove = async (approvalId: string, notes?: string) => {
    try {
      await flowsApi.approve(id, approvalId, notes);
      toast.success('Phase transition approved');
      fetchData();
    } catch {
      toast.error('Approval failed');
    }
  };

  const handleReject = async (approvalId: string, notes?: string) => {
    try {
      await flowsApi.reject(id, approvalId, notes);
      toast.success('Phase transition rejected');
      fetchData();
    } catch {
      toast.error('Rejection failed');
    }
  };

  /* first pending approval (if any) */
  const pendingApproval =
    approvals.find((a) => a.status === 'pending') ?? null;

  /* browser notification for pending approvals */
  const prevPendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingApproval) {
      prevPendingRef.current = null;
      return;
    }
    if (pendingApproval.id === prevPendingRef.current) return;
    prevPendingRef.current = pendingApproval.id;

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      new Notification('PENTAGRON — Approval Required', {
        body: `Phase transition needs authorization: ${pendingApproval.phase ?? 'unknown'}`,
        icon: '/icons/icon-192x192.svg',
      });
    }
  }, [pendingApproval]);

  /* ── loading skeleton ── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 font-mono bg-mc-bg min-h-screen">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-4 flex-1">
          <Skeleton className="flex-1 h-[600px]" />
          <Skeleton className="w-1/4 h-[600px]" />
          <Skeleton className="w-1/4 h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-mc-bg text-mc-text font-mono">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="shrink-0 border-b border-mc-border px-6 py-4 space-y-3">
        {/* breadcrumb + status + actions */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-mc-text-ghost">
            <Link
              href="/"
              className="hover:text-mc-text-dim transition-colors"
            >
              [PEN]
            </Link>
            <span>/</span>
            {flow?.project_id && (
              <>
                <Link
                  href={`/projects/${flow.project_id}`}
                  className="hover:text-mc-text-dim transition-colors"
                >
                  project
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-mc-text">{flow?.name ?? id}</span>
          </nav>

          {/* status indicator */}
          <div className="flex items-center gap-2 ml-auto">
            <GlowDot status={statusToGlow(flow?.status)} />
            <StatusBadge status={flow?.status ?? 'pending'} />
          </div>

          {/* action buttons */}
          <div className="flex items-center gap-2">
            {flow?.status === 'pending' && (
              <Button onClick={handleStart} size="sm">
                START
              </Button>
            )}
            {(flow?.status === 'running' ||
              flow?.status === 'paused') && (
              <Button onClick={handleCancel} variant="danger" size="sm">
                CANCEL
              </Button>
            )}
            {(flow?.status === 'completed' || flow?.status === 'failed') && (
              <Button
                onClick={async () => {
                  if (!flow) return;
                  try {
                    const res = await flowsApi.reportDownload(id);
                    const blob = new Blob([res.data], { type: 'text/markdown' });
                    const safeName = (flow.name ?? flow.id).replace(/[^a-zA-Z0-9_-]/g, '_');
                    downloadBlob(blob, `pentagron-report-${safeName}.md`);
                    toast.success('Report exported');
                  } catch {
                    toast.error('Failed to export report');
                  }
                }}
                size="sm"
              >
                EXPORT REPORT
              </Button>
            )}
          </div>
        </div>

        {/* phase progress bar */}
        <PhaseProgress currentPhase={flow?.phase ?? 'recon'} status={flow?.status ?? 'pending'} />
      </header>

      {/* ═══════════ 3-PANEL LAYOUT (50% | 25% | 25%) ═══════════ */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ── LEFT: Agent Activity (50%) ── */}
        <section className="flex-1 lg:w-1/2 min-h-[400px] lg:min-h-0 border-r border-mc-border">
          <AgentChat flowId={id} />
        </section>

        {/* ── CENTER: Telemetry (25%) ── */}
        <section className="lg:w-1/4 border-r border-mc-border overflow-y-auto">
          <Panel title="TELEMETRY">
            <div className="space-y-4 p-4">
              <div className="space-y-1">
                <DataLabel>PHASE</DataLabel>
                <p className="text-sm text-mc-text">
                  {flow?.phase ?? '\u2014'}
                </p>
              </div>

              <div className="space-y-1">
                <DataLabel>PATH</DataLabel>
                <p className="text-sm text-mc-text">
                  {flow?.attack_path ?? 'unclassified'}
                </p>
              </div>

              <div className="space-y-1">
                <DataLabel>STARTED</DataLabel>
                <p className="text-sm text-mc-text">
                  {formatTimestamp(flow?.started_at)}
                </p>
              </div>

              <div className="space-y-1">
                <DataLabel>ENDED</DataLabel>
                <p className="text-sm text-mc-text">
                  {formatTimestamp(flow?.completed_at)}
                </p>
              </div>

              <div className="space-y-1">
                <DataLabel>STATUS</DataLabel>
                <StatusBadge status={flow?.status ?? 'pending'} />
              </div>
            </div>
          </Panel>
        </section>

        {/* ── RIGHT: EvoGraph (25%) ── */}
        <section className="lg:w-1/4 overflow-hidden">
          <Panel title="EVOGRAPH">
            <div className="p-2 h-full">
              <GraphVisualization
                nodes={graphNodes}
                edges={graphEdges}
                width={300}
                height={500}
              />
            </div>
          </Panel>
        </section>
      </main>

      {/* ═══════════ APPROVAL DIALOG ═══════════ */}
      <ApprovalDialog
        approval={pendingApproval}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
