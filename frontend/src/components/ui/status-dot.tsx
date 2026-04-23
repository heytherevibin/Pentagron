'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const TONE: Record<Tone, string> = {
  accent:  'bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.6)]',
  success: 'bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.6)]',
  warning: 'bg-sev-medium shadow-[0_0_12px_hsl(var(--sev-medium)/0.5)]',
  danger:  'bg-sev-critical shadow-[0_0_12px_hsl(var(--sev-critical)/0.5)]',
  info:    'bg-sev-low shadow-[0_0_12px_hsl(var(--sev-low)/0.5)]',
  muted:   'bg-fg-subtle',
}

const HALO: Record<Tone, string> = {
  accent:  'bg-accent/40',
  success: 'bg-accent/40',
  warning: 'bg-sev-medium/40',
  danger:  'bg-sev-critical/40',
  info:    'bg-sev-low/40',
  muted:   'bg-fg-subtle/30',
}

/* CSS-variable-aware ring colors for the radar ripple */
const RING_COLOR: Record<Tone, string> = {
  accent:  'hsl(var(--accent))',
  success: 'hsl(var(--accent))',
  warning: 'hsl(var(--sev-medium))',
  danger:  'hsl(var(--sev-critical))',
  info:    'hsl(var(--sev-low))',
  muted:   'hsl(var(--fg-subtle))',
}

/**
 * StatusDot — pulsing dot for live state indicators with multi-ring radar effect.
 *
 *   <StatusDot tone="accent" pulse />
 */
export function StatusDot({
  tone = 'muted',
  pulse,
  /** Diameter in px. Default 6. */
  size = 6,
  className,
}: {
  tone?: Tone
  pulse?: boolean
  size?: number
  className?: string
}) {
  const ringColor = RING_COLOR[tone]

  return (
    <span
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size * 2.5, height: size * 2.5 }}
    >
      {/* Radar ripple rings — two staggered for depth */}
      {pulse && (
        <>
          <span
            className="absolute rounded-full animate-[radar-ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]"
            style={{
              width: size * 2.2,
              height: size * 2.2,
              border: `1px solid ${ringColor}`,
              opacity: 0,
            }}
          />
          <span
            className="absolute rounded-full animate-[radar-ping_2.4s_cubic-bezier(0,0,0.2,1)_0.8s_infinite]"
            style={{
              width: size * 2.2,
              height: size * 2.2,
              border: `1px solid ${ringColor}`,
              opacity: 0,
            }}
          />
        </>
      )}

      {/* Soft halo glow */}
      {pulse && (
        <span
          className={cn(
            'absolute rounded-full animate-pulse-soft',
            HALO[tone],
          )}
          style={{ width: size * 1.8, height: size * 1.8 }}
        />
      )}

      {/* Core dot */}
      <span
        className={cn('relative inline-flex rounded-full', TONE[tone])}
        style={{ width: size, height: size }}
      />
    </span>
  )
}
