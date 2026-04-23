'use client'

import * as React from 'react'
import useSWR from 'swr'
import { RotateCw, CircleCheck, CircleX, CircleDot, Loader2, PauseCircle, XCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { runs as runsApi } from '@/lib/api'
import { STATUS_CLASSES, STATUS_LABEL, PHASE_LABEL } from '@/lib/constants'
import { cn, formatDateTime, formatDuration, timeAgo } from '@/lib/utils'
import type { FlowRun, FlowStatus } from '@/types'

/**
 * RunsHistory — previous runs of a flow with timing, delta, and retry button.
 *
 * Per-run rows expand a compact delta strip: findings-count delta vs. the
 * immediately-prior completed run so operators can eyeball whether a flow
 * is stabilising or regressing.
 */
export function RunsHistory({ flowId }: { flowId: string }) {
  const { data, isLoading, mutate } = useSWR<FlowRun[]>(
    ['flow-runs', flowId],
    async () => {
      try {
        const r = await runsApi.list(flowId)
        const d = r.data as { runs?: FlowRun[] } | FlowRun[]
        return Array.isArray(d) ? d : (d.runs ?? [])
      } catch {
        return []
      }
    },
    { refreshInterval: 20_000 },
  )

  const runs = React.useMemo(() => {
    return (data ?? [])
      .slice()
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  }, [data])

  const handleRetry = async (runId: string) => {
    try {
      await runsApi.retry(flowId, runId)
      toast.success('Retry queued')
      void mutate()
    } catch {
      toast.error('Retry failed')
    }
  }

  if (isLoading) {
    return <RunsSkeleton />
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
            <CircleDot className="h-4 w-4 text-fg-subtle" />
          </div>
          <div>
            <div className="text-sm font-medium text-fg">No run history yet</div>
            <div className="mt-1 text-xs text-fg-muted max-w-sm">
              The first time this flow is started, it&apos;ll appear here. Future retries, scheduled runs, and
              manual re-launches are tracked for longitudinal comparison.
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ol className="relative flex flex-col gap-0 border-l border-border-subtle ml-3">
      {runs.map((run, i) => {
        const prev = runs[i + 1]
        const delta = prev ? run.findings_count - prev.findings_count : null
        return (
          <li key={run.id} className="relative pl-6 pr-1 py-4 first:pt-2 last:pb-2">
            <TimelineDot status={run.status} />
            <RunRow run={run} delta={delta} onRetry={() => handleRetry(run.id)} />
          </li>
        )
      })}
    </ol>
  )
}

function RunRow({
  run,
  delta,
  onRetry,
}: {
  run: FlowRun
  delta: number | null
  onRetry: () => void
}) {
  const cls = STATUS_CLASSES[run.status]
  const canRetry = run.status === 'failed' || run.status === 'cancelled'

  return (
    <div
      className={cn(
        'rounded-md border border-border-subtle bg-bg-subtle/40 p-3',
        'hover:border-border-strong transition-colors duration-120',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-fg">
              Run · <span className="font-mono text-fg-subtle">{run.id.slice(0, 8)}</span>
            </span>
            <Badge variant="outline" className={cn(cls.text, cls.border, 'text-2xs')}>
              {STATUS_LABEL[run.status]}
            </Badge>
            <Badge variant="outline" className="text-2xs uppercase">
              {PHASE_LABEL[run.phase]}
            </Badge>
            <Badge variant="outline" className="text-2xs uppercase text-fg-subtle">
              {run.trigger}
            </Badge>
          </div>
          <div className="mt-1.5 meta-mono flex items-center gap-2 flex-wrap">
            <span>{formatDateTime(run.started_at)}</span>
            <span className="text-fg-disabled">·</span>
            <span>started {timeAgo(run.started_at)}</span>
            {run.duration_ms !== undefined && (
              <>
                <span className="text-fg-disabled">·</span>
                <span>ran {formatDuration(run.duration_ms)}</span>
              </>
            )}
            {run.triggered_by && (
              <>
                <span className="text-fg-disabled">·</span>
                <span>by {run.triggered_by}</span>
              </>
            )}
          </div>
        </div>

        {canRetry && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={onRetry}
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </Button>
        )}
      </div>

      {/* Delta + findings strip */}
      <div className="mt-2.5 flex items-center gap-3 text-2xs font-mono">
        <span className="inline-flex items-center gap-1">
          <span className="text-fg-subtle">findings</span>
          <span className="text-fg font-semibold tabular-nums">{run.findings_count}</span>
        </span>
        {run.critical_count > 0 && (
          <span className="inline-flex items-center gap-1 text-sev-critical">
            <span className="uppercase">crit</span>
            <span className="font-semibold tabular-nums">{run.critical_count}</span>
          </span>
        )}
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 border',
              delta > 0
                ? 'text-sev-high border-sev-high/30 bg-sev-high/10'
                : 'text-accent border-accent/30 bg-accent/10',
            )}
          >
            <Sparkles className="h-2.5 w-2.5" />
            {delta > 0 ? '+' : ''}
            {delta} vs prev
          </span>
        )}
      </div>
    </div>
  )
}

function TimelineDot({ status }: { status: FlowStatus }) {
  const Icon =
    status === 'running'
      ? Loader2
      : status === 'completed'
        ? CircleCheck
        : status === 'failed'
          ? CircleX
          : status === 'paused'
            ? PauseCircle
            : status === 'cancelled'
              ? XCircle
              : CircleDot
  const color = STATUS_CLASSES[status].text
  return (
    <span
      className={cn(
        'absolute -left-[9px] top-5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-bg border border-border-strong',
        color,
      )}
      aria-hidden
    >
      <Icon className={cn('h-2.5 w-2.5', status === 'running' && 'animate-spin')} />
    </span>
  )
}

function RunsSkeleton() {
  return (
    <ol className="flex flex-col gap-3 border-l border-border-subtle ml-3 pl-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-md border border-border-subtle bg-bg-subtle/40 p-3">
          <div className="h-3 w-40 skeleton rounded" />
          <div className="mt-2 h-2.5 w-64 skeleton rounded" />
        </div>
      ))}
    </ol>
  )
}
