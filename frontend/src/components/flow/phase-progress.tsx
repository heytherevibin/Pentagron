'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PHASE_ORDER, PHASE_LABEL, PHASE_SHORT } from '@/lib/constants'
import type { Phase } from '@/types'

/**
 * PhaseProgress — horizontal pipeline breadcrumb.
 *
 *   ● Recon ──── ● Analysis ──── ◉ Exploit ──── ○ Post-Ex ──── ○ Report
 *
 * The accent bar underneath fills proportional to the current phase index.
 * A pulsing dot marks the active phase.
 */
export function PhaseProgress({
  current,
  className,
}: {
  current: Phase
  className?: string
}) {
  const currentIdx = Math.max(0, PHASE_ORDER.indexOf(current))

  return (
    <div className={cn('w-full', className)}>
      <ol className="grid grid-cols-6 gap-1">
        {PHASE_ORDER.map((phase, i) => {
          const state: 'done' | 'active' | 'upcoming' =
            i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'upcoming'
          return (
            <li key={phase} className="flex flex-col items-start gap-1.5 min-w-0">
              <div className="flex items-center gap-2 w-full">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full border shrink-0 text-2xs font-mono',
                    state === 'done' && 'bg-accent/15 border-accent/50 text-accent',
                    state === 'active' && 'bg-accent/10 border-accent text-accent',
                    state === 'upcoming' && 'bg-bg-muted border-border text-fg-subtle',
                  )}
                >
                  {state === 'done' ? (
                    <Check className="h-3 w-3" />
                  ) : state === 'active' ? (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0.4 }}
                      animate={{ scale: [0.7, 1, 0.7], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="h-1.5 w-1.5 rounded-full bg-accent"
                    />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-fg-subtle/40" />
                  )}
                </span>
                <div
                  className={cn(
                    'h-px flex-1 min-w-0',
                    i < currentIdx ? 'bg-accent/50' : 'bg-border',
                  )}
                />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    'text-2xs uppercase tracking-widest font-mono truncate',
                    state === 'upcoming' ? 'text-fg-subtle' : 'text-fg-muted',
                    state === 'active' && 'text-accent',
                  )}
                >
                  <span className="hidden sm:inline">{PHASE_LABEL[phase]}</span>
                  <span className="sm:hidden">{PHASE_SHORT[phase]}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
