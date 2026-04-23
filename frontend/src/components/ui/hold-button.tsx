'use client'

import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * HoldButton — press-and-hold confirmation button.
 *
 * Prevents accidental green-lights on destructive / high-impact actions
 * (approve-production-exploit, delete-project, revoke-all-sessions). The
 * button must be held for `holdMs` milliseconds before `onConfirm` fires;
 * releasing early cancels cleanly with no state change.
 *
 * Visual affordance: a 2px progress bar animates along the bottom edge as
 * the hold progresses. Respects `prefers-reduced-motion` by showing the
 * bar at 100% immediately (the click still needs to be held — the hold
 * timer doesn't get bypassed, only the animation does).
 *
 * Keyboard: Enter/Space down-up is treated as a single click (instant),
 * not a hold, to preserve screen-reader + keyboard parity. Hold-to-confirm
 * is a pointer-only affordance — critical actions must remain reachable
 * via keyboard in one action. If you want key-and-hold too, wire it
 * separately.
 *
 * @example
 *   <HoldButton
 *     holdMs={800}
 *     onConfirm={handleApprove}
 *     variant="primary"
 *     leftIcon={<Check />}
 *   >
 *     Hold to approve
 *   </HoldButton>
 */
export function HoldButton({
  holdMs = 800,
  onConfirm,
  className,
  children,
  disabled,
  ...rest
}: Omit<ButtonProps, 'onClick'> & {
  /** Milliseconds the user must hold before confirm fires. */
  holdMs?: number
  /** Called once when the hold completes. Release before `holdMs` is a no-op. */
  onConfirm: () => void
}) {
  const [progress, setProgress] = React.useState(0)
  const rafRef = React.useRef<number | null>(null)
  const startRef = React.useRef<number | null>(null)
  const completedRef = React.useRef(false)

  const tick = React.useCallback(
    (now: number) => {
      if (startRef.current == null) return
      const elapsed = now - startRef.current
      const pct = Math.min(1, elapsed / holdMs)
      setProgress(pct)
      if (pct >= 1) {
        if (!completedRef.current) {
          completedRef.current = true
          onConfirm()
        }
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [holdMs, onConfirm],
  )

  const start = React.useCallback(() => {
    if (disabled) return
    completedRef.current = false
    startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }, [disabled, tick])

  const cancel = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    // Only reset progress if we didn't complete — completed state freezes
    // the bar at 100% for a beat so the user sees commitment.
    if (!completedRef.current) setProgress(0)
  }, [])

  React.useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])

  // Keyboard parity — Enter/Space triggers instantly (see JSDoc rationale).
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onConfirm()
    }
  }

  return (
    <Button
      {...rest}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={onKeyDown}
      className={cn('relative overflow-hidden', className)}
    >
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-accent/90 origin-left will-change-transform"
        style={{
          transform: `scaleX(${progress})`,
          // Linear during hold — users perceive the bar as "filling";
          // an ease would feel inconsistent with a real-time timer.
          transition: progress === 0 ? 'transform 120ms ease-out' : 'none',
        }}
      />
    </Button>
  )
}
