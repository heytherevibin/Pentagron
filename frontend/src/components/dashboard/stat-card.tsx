'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * StatCard — compact metric tile used on the dashboard hero strip.
 *
 *   [ icon ]   Label
 *              Big value    +12 delta
 */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'muted',
  icon: Icon,
  hint,
  className,
  index = 0,
}: {
  label: string
  value: string | number
  delta?: string
  deltaTone?: 'accent' | 'danger' | 'muted'
  icon: LucideIcon
  hint?: string
  className?: string
  /** Animation stagger index. */
  index?: number
}) {
  const deltaClass =
    deltaTone === 'accent'
      ? 'text-accent'
      : deltaTone === 'danger'
        ? 'text-sev-critical'
        : 'text-fg-subtle'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-bg-subtle/40',
        'p-4 transition-colors duration-180 hover:bg-bg-subtle/60 hover:border-border-strong',
        className,
      )}
    >
      {/* Accent glow top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(closest-side, hsl(var(--accent)/0.12), transparent 70%)',
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-muted">
          <Icon className="h-3.5 w-3.5 text-accent" />
        </div>
        {delta && (
          <span className={cn('text-2xs font-mono uppercase tracking-widest', deltaClass)}>
            {delta}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
          {label}
        </div>
        <div className="mt-1 text-2xl tracking-tight font-medium text-fg tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-fg-subtle truncate">{hint}</div>
        )}
      </div>
    </motion.div>
  )
}
