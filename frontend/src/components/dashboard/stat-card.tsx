'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────────────────── */
/*   Sparkline — tiny inline SVG chart for visual data representation        */
/* ────────────────────────────────────────────────────────────────────────── */

function Sparkline({
  data,
  width = 64,
  height = 24,
  color = 'hsl(var(--accent))',
  className,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height * 0.8 - height * 0.1,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      fill="none"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path d={linePath} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Glow dot on latest point */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="4"
        fill={color}
        opacity="0.3"
      >
        <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   Progress Ring — circular mini-gauge for ratios like "5/6"               */
/* ────────────────────────────────────────────────────────────────────────── */

function ProgressRing({
  value,
  max,
  size = 28,
  strokeWidth = 2.5,
  color = 'hsl(var(--accent))',
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? value / max : 0
  const dashOffset = circumference * (1 - progress)

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--border-strong))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*   StatCard — premium glassmorphic metric tile with animated hover border  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * StatCard — compact metric tile used on the dashboard hero strip.
 *
 *   [ icon ]   Label
 *              Big value    +12 delta
 *              [sparkline or ring]
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
  sparkData,
  ring,
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
  /** Optional sparkline data points for trend visualization. */
  sparkData?: number[]
  /** Optional ring progress { value, max } for ratio display. */
  ring?: { value: number; max: number }
}) {
  const deltaClass =
    deltaTone === 'accent'
      ? 'text-accent'
      : deltaTone === 'danger'
        ? 'text-sev-critical'
        : 'text-fg-subtle'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative overflow-hidden rounded-lg',
        /* Glassmorphism */
        'bg-bg-subtle/30 backdrop-blur-xl',
        'border border-white/[0.06]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_1px_3px_rgba(0,0,0,0.4)]',
        /* Interaction */
        'p-4 transition-all duration-300',
        'hover:bg-bg-subtle/50 hover:border-white/[0.12]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_4px_16px_rgba(0,0,0,0.5),_0_0_24px_-8px_hsl(var(--accent)/0.15)]',
        className,
      )}
    >
      {/* Animated gradient border on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'conic-gradient(from 180deg at 50% 50%, hsl(var(--accent)/0.3) 0deg, transparent 60deg, transparent 300deg, hsl(var(--accent)/0.3) 360deg)',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
        }}
      />

      {/* Accent ambient glow — top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(closest-side, hsl(var(--accent)/0.10), transparent 70%)',
        }}
      />

      {/* Noise texture overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.03] bg-noise mix-blend-overlay"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04]">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="flex items-center gap-2">
          {delta && (
            <span className={cn('text-2xs font-mono uppercase tracking-widest', deltaClass)}>
              {delta}
            </span>
          )}
          {ring && (
            <ProgressRing value={ring.value} max={ring.max} />
          )}
        </div>
      </div>

      <div className="relative mt-4">
        <div className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
          {label}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="text-2xl tracking-tight font-semibold text-fg tabular-nums">
            {value}
          </div>
          {sparkData && sparkData.length >= 2 && (
            <Sparkline data={sparkData} width={56} height={20} />
          )}
        </div>
        {hint && (
          <div className="mt-1.5 text-xs text-fg-subtle truncate">{hint}</div>
        )}
      </div>
    </motion.div>
  )
}
