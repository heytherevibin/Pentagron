import type { Flow } from '@/types'
import { cn } from '@/lib/cn'
import { StatusBadge } from './StatusBadge'

interface FlowTickerProps {
  flow: Flow | null
}

const PHASES = ['recon', 'analysis', 'exploitation', 'post_exploitation', 'reporting', 'cleanup'] as const

const DOT_COLORS: Record<string, string> = {
  completed: 'bg-mc-emerald',
  current_running: 'bg-mc-blue animate-pulse',
  current_paused: 'bg-mc-amber',
  current_other: 'bg-mc-amber',
  future: 'bg-mc-border',
}

function getPhaseDotStyle(
  phaseIdx: number,
  currentIdx: number,
  status: string,
): string {
  if (phaseIdx < currentIdx) return DOT_COLORS.completed
  if (phaseIdx === currentIdx) {
    if (status === 'running') return DOT_COLORS.current_running
    if (status === 'paused') return DOT_COLORS.current_paused
    return DOT_COLORS.current_other
  }
  return DOT_COLORS.future
}

export function FlowTicker({ flow }: FlowTickerProps) {
  if (!flow || (flow.status !== 'running' && flow.status !== 'paused')) {
    return null
  }

  const currentIdx = PHASES.indexOf(flow.phase as typeof PHASES[number])

  return (
    <div className="flex items-center gap-2.5 text-xs font-mono">
      <span className="text-mc-text-dim truncate max-w-[20ch]">{flow.name}</span>
      <StatusBadge status={flow.status} variant="flow" />
      <div className="flex items-center gap-1">
        {PHASES.map((_, idx) => (
          <span
            key={idx}
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              getPhaseDotStyle(idx, currentIdx, flow.status),
            )}
          />
        ))}
      </div>
    </div>
  )
}
