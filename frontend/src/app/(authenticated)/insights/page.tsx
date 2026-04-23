'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  ShieldCheck,
  Target,
  Workflow,
  Zap,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { MetricCard } from '@/components/insights/metric-card'
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  SEV_COLOR,
} from '@/components/insights/chart-theme'
import { insights } from '@/lib/api'
import { useUrlState } from '@/hooks/useUrlState'
import type {
  MetricSummary,
  PhaseDurationBucket,
  SeverityTimeseries,
  TopTarget,
} from '@/types'

type Window = '24h' | '7d' | '30d'

/**
 * Insights — operator-facing analytics dashboard.
 *
 * Layout:
 *   row 1 — 6 KPI tiles (flows, findings by severity, approvals)
 *   row 2 — findings-over-time stacked area + approval-latency line
 *   row 3 — phase-duration bars + top-targets list
 *
 * Every fetch degrades gracefully to empty data so charts render (even if
 * with zero-series) while backend endpoints are under construction.
 */
export default function InsightsPage() {
  const [window, setWindow] = useUrlState<Window>('window', '7d')

  const { data: summary, isLoading: summaryLoading } = useSWR<MetricSummary>(
    ['insights-summary', window],
    async () => {
      try {
        const r = await insights.summary(window)
        return r.data as MetricSummary
      } catch {
        return EMPTY_SUMMARY
      }
    },
    { refreshInterval: 30_000 },
  )

  const { data: series, isLoading: seriesLoading } = useSWR<SeverityTimeseries>(
    ['insights-findings', window],
    async () => {
      try {
        const r = await insights.findingsOverTime(window)
        return r.data as SeverityTimeseries
      } catch {
        return { points: [] }
      }
    },
    { refreshInterval: 30_000 },
  )

  const { data: phaseBuckets } = useSWR<PhaseDurationBucket[]>(
    ['insights-phase', window],
    async () => {
      try {
        const r = await insights.phaseDurations(window)
        return (r.data as { buckets?: PhaseDurationBucket[] }).buckets ?? (r.data as PhaseDurationBucket[])
      } catch {
        return []
      }
    },
    { refreshInterval: 60_000 },
  )

  const { data: topTargets } = useSWR<TopTarget[]>(
    ['insights-top'],
    async () => {
      try {
        const r = await insights.topTargets(10)
        return (r.data as { targets?: TopTarget[] }).targets ?? (r.data as TopTarget[])
      } catch {
        return []
      }
    },
    { refreshInterval: 60_000 },
  )

  const { data: approvalLatency } = useSWR(
    ['insights-approval', window],
    async () => {
      try {
        const r = await insights.approvalLatency(window)
        return (r.data as { points: Array<{ bucket: string; p50_seconds: number; p95_seconds: number }> })
          .points
      } catch {
        return [] as Array<{ bucket: string; p50_seconds: number; p95_seconds: number }>
      }
    },
    { refreshInterval: 60_000 },
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Analytics"
        title="Insights"
        subtitle="Findings, flow throughput, and phase latency across your engagements."
        actions={
          <Tabs value={window} onValueChange={(v) => setWindow(v as Window)}>
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Row 1 — KPI tiles */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Flows running"
          value={summary?.running_flows ?? 0}
          suffix={`/ ${summary?.total_flows ?? 0}`}
          icon={Workflow}
          loading={summaryLoading}
          tone="accent"
        />
        <MetricCard
          label="Findings"
          value={summary?.total_findings ?? 0}
          icon={Zap}
          loading={summaryLoading}
        />
        <MetricCard
          label="Critical"
          value={summary?.critical_findings ?? 0}
          icon={Flame}
          loading={summaryLoading}
          tone="critical"
        />
        <MetricCard
          label="High"
          value={summary?.high_findings ?? 0}
          icon={AlertTriangle}
          loading={summaryLoading}
          tone="high"
        />
        <MetricCard
          label="Approvals pending"
          value={summary?.approvals_pending ?? 0}
          icon={ShieldCheck}
          loading={summaryLoading}
          tone={summary && summary.approvals_pending > 0 ? 'medium' : 'default'}
        />
        <MetricCard
          label="MTTF"
          value={summary?.mean_time_to_finding_seconds ? humanDuration(summary.mean_time_to_finding_seconds) : '—'}
          icon={Clock}
          loading={summaryLoading}
        />
      </div>

      {/* Row 2 — findings timeseries + approval latency */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Findings over time</CardTitle>
            <p className="meta-mono mt-0.5">Stacked by severity · {window}</p>
          </CardHeader>
          <CardContent>
            {seriesLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : series && series.points.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series.points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    {(['critical', 'high', 'medium', 'low', 'info'] as const).map((k) => (
                      <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SEV_COLOR[k]} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={SEV_COLOR[k]} stopOpacity={0.05} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="bucket" {...CHART_AXIS} tickFormatter={formatXTick} />
                  <YAxis {...CHART_AXIS} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={formatXTick} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', paddingTop: 8 }}
                    iconType="square"
                  />
                  {(['critical', 'high', 'medium', 'low', 'info'] as const).map((k) => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stackId="1"
                      stroke={SEV_COLOR[k]}
                      fill={`url(#grad-${k})`}
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No findings recorded in this window yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approval latency</CardTitle>
            <p className="meta-mono mt-0.5">p50 / p95 · {window}</p>
          </CardHeader>
          <CardContent>
            {approvalLatency && approvalLatency.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={approvalLatency} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="bucket" {...CHART_AXIS} tickFormatter={formatXTick} />
                  <YAxis
                    {...CHART_AXIS}
                    tickFormatter={(v) => humanDuration(Number(v))}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelFormatter={formatXTick}
                    formatter={(v: number) => humanDuration(v)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', paddingTop: 8 }}
                    iconType="line"
                  />
                  <Line
                    type="monotone"
                    dataKey="p50_seconds"
                    name="p50"
                    stroke="hsl(var(--accent))"
                    strokeWidth={1.6}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="p95_seconds"
                    name="p95"
                    stroke="hsl(var(--sev-medium))"
                    strokeWidth={1.6}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No approvals resolved in this window yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — phase durations + top targets */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Phase duration distribution</CardTitle>
            <p className="meta-mono mt-0.5">p50 / p90 / p99 seconds per phase</p>
          </CardHeader>
          <CardContent>
            {phaseBuckets && phaseBuckets.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={phaseBuckets} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid {...CHART_GRID} vertical={false} />
                  <XAxis dataKey="phase" {...CHART_AXIS} />
                  <YAxis {...CHART_AXIS} tickFormatter={(v) => humanDuration(Number(v))} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => humanDuration(v)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', paddingTop: 8 }}
                    iconType="square"
                  />
                  <Bar dataKey="p50_seconds" name="p50" fill="hsl(var(--accent) / 0.9)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="p90_seconds" name="p90" fill="hsl(var(--sev-low) / 0.9)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="p99_seconds" name="p99" fill="hsl(var(--sev-high) / 0.9)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Need at least one completed flow to compute percentiles." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top targets</CardTitle>
            <p className="meta-mono mt-0.5">By finding count · all time</p>
          </CardHeader>
          <CardContent className="pt-0">
            {topTargets && topTargets.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border-subtle/60">
                {topTargets.map((t, i) => (
                  <li key={t.target} className="flex items-center gap-3 py-2.5">
                    <span className="text-2xs font-mono text-fg-disabled w-5 text-right">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-fg truncate">{t.target}</div>
                      <div className="meta-mono mt-0.5">
                        {t.flow_count} flow{t.flow_count === 1 ? '' : 's'} · {t.finding_count} finding
                        {t.finding_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <Target className="h-3 w-3 text-fg-subtle shrink-0" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyChart message="No targets have been scanned yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footnote */}
      <div className="mt-4 flex items-center gap-1.5 text-2xs text-fg-subtle font-mono">
        <CheckCircle2 className="h-3 w-3 text-accent" />
        Data refreshes every 30s — pulls straight from the /api/insights endpoints.
      </div>
    </PageShell>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 rounded-md border border-border-subtle bg-dot-grid bg-bg-subtle/30">
      <p className="text-xs text-fg-subtle max-w-sm text-center px-6">{message}</p>
    </div>
  )
}

function formatXTick(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

function humanDuration(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return '—'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

const EMPTY_SUMMARY: MetricSummary = {
  total_flows: 0,
  running_flows: 0,
  completed_flows: 0,
  failed_flows: 0,
  total_findings: 0,
  critical_findings: 0,
  high_findings: 0,
  medium_findings: 0,
  low_findings: 0,
  approvals_pending: 0,
  approvals_resolved_24h: 0,
}

// Suppress ts-6133 (Cell unused) — imported for future pie variants.
void Cell
