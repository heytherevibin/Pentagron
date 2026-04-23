'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * LiveDot — the canonical "something is happening" indicator.
 *
 *   • accent   — agent running, scan in progress, healthy live state (default)
 *   • critical — unacknowledged critical finding, production-target warning
 *   • neutral  — static sibling, no pulse (for "idle" comparisons)
 *
 * Size defaults to 8px (`sm`); `md` is 10px for inline-with-heading use.
 * Pulse is automatically disabled when the user has set
 * `prefers-reduced-motion: reduce` (the keyframe is neutralized globally
 * in globals.css). Render inside a text node to keep baseline alignment.
 *
 * @example
 *   <span className="inline-flex items-center gap-1.5">
 *     <LiveDot /> <span className="meta-mono">running</span>
 *   </span>
 */
export function LiveDot({
  variant = 'accent',
  size = 'sm',
  pulse = true,
  className,
  ...rest
}: {
  variant?: 'accent' | 'critical' | 'neutral'
  size?: 'sm' | 'md'
  /** Disable the ring-pulse animation without removing the dot. */
  pulse?: boolean
  className?: string
} & React.HTMLAttributes<HTMLSpanElement>) {
  const dim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  const color =
    variant === 'critical'
      ? 'bg-sev-critical'
      : variant === 'neutral'
        ? 'bg-fg-subtle'
        : 'bg-accent'
  const pulseClass =
    pulse && variant === 'critical'
      ? 'pulse-critical'
      : pulse && variant === 'accent'
        ? 'pulse-accent'
        : ''
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        dim,
        color,
        pulseClass,
        className,
      )}
      {...rest}
    />
  )
}
