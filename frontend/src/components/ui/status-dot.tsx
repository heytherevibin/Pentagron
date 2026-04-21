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

/**
 * StatusDot — small pulsing dot for live state indicators.
 *
 *   <StatusDot tone="accent" pulse />
 */
export function StatusDot({
  tone = 'muted',
  pulse,
  size = 6,
  className,
}: {
  tone?: Tone
  pulse?: boolean
  /** Diameter in px. Default 6. */
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', HALO[tone])}
        />
      )}
      <span
        className={cn('relative inline-flex h-full w-full rounded-full', TONE[tone])}
      />
    </span>
  )
}
