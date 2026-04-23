'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn, formatNumber } from '@/lib/utils'

/**
 * MetricCard — compact KPI tile used across /insights and the root dashboard.
 * Deltas render as coloured arrows (down = good for findings, up = good for
 * flows — caller controls via `deltaDirection`).
 */
export function MetricCard({
  label,
  value,
  delta,
  deltaDirection = 'higher-is-better',
  suffix,
  icon: Icon,
  className,
  tone = 'default',
  loading,
}: {
  label: string
  value: number | string
  delta?: number
  deltaDirection?: 'higher-is-better' | 'lower-is-better'
  suffix?: string
  icon?: React.ElementType
  className?: string
  tone?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'accent'
  loading?: boolean
}) {
  const toneClasses = {
    default: 'border-border',
    critical: 'border-sev-critical/30 bg-sev-critical/[0.03]',
    high: 'border-sev-high/30 bg-sev-high/[0.03]',
    medium: 'border-sev-medium/30 bg-sev-medium/[0.03]',
    low: 'border-sev-low/30 bg-sev-low/[0.03]',
    accent: 'border-accent/30 bg-accent/[0.03]',
  }[tone]

  const arrow =
    delta === undefined ? null : delta === 0 ? (
      <Minus className="h-3 w-3" />
    ) : delta > 0 ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )

  const good =
    delta === undefined
      ? null
      : deltaDirection === 'higher-is-better'
        ? delta > 0
        : delta < 0

  return (
    <Card className={cn(toneClasses, className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="meta-mono">{label}</div>
          {Icon && <Icon className="h-3.5 w-3.5 text-fg-subtle shrink-0" />}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          {loading ? (
            <span className="inline-block h-7 w-20 rounded skeleton" />
          ) : (
            <span className="text-2xl font-semibold text-fg tabular-nums leading-none">
              {typeof value === 'number' ? formatNumber(value) : value}
            </span>
          )}
          {suffix && (
            <span className="text-xs text-fg-subtle font-mono">{suffix}</span>
          )}
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-2xs font-mono',
              good === null
                ? 'text-fg-subtle'
                : good
                  ? 'text-accent'
                  : 'text-sev-critical',
            )}
          >
            {arrow}
            <span>{Math.abs(delta).toFixed(1)}%</span>
            <span className="text-fg-subtle">vs prev window</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
