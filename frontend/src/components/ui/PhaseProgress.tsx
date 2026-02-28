import type { FlowStatus } from '@/types'
import { cn } from '@/lib/cn'

interface PhaseProgressProps {
  currentPhase: string
  status: FlowStatus
  compact?: boolean
}

const PHASES = ['recon', 'analysis', 'exploitation', 'post_exploitation', 'reporting', 'cleanup'] as const

const PHASE_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500',
  running:   'bg-blue-500 animate-pulse',
  paused:    'bg-amber-500',
  failed:    'bg-red-500',
  default:   'bg-amber-500',
}

function getSegmentStyle(
  phase: string,
  currentPhase: string,
  status: FlowStatus,
): string {
  const currentIdx = PHASES.indexOf(currentPhase as typeof PHASES[number])
  const phaseIdx = PHASES.indexOf(phase as typeof PHASES[number])

  if (phaseIdx < currentIdx) return 'bg-emerald-500'
  if (phaseIdx === currentIdx) return PHASE_COLORS[status] ?? PHASE_COLORS.default
  return 'bg-surface-3'
}

function formatPhaseLabel(phase: string): string {
  return phase.replace(/_/g, ' ')
}

export function PhaseProgress({ currentPhase, status, compact }: PhaseProgressProps) {
  const currentIdx = PHASES.indexOf(currentPhase as typeof PHASES[number])

  return (
    <div>
      <div className="flex gap-px">
        {PHASES.map((phase) => (
          <div
            key={phase}
            className={cn(
              'h-1.5 flex-1',
              getSegmentStyle(phase, currentPhase, status),
            )}
          />
        ))}
      </div>
      {!compact && (
        <div className="flex gap-px mt-2">
          {PHASES.map((phase, idx) => (
            <span
              key={phase}
              className={cn(
                'flex-1 text-[10px] font-mono uppercase tracking-widest-plus text-center',
                idx === currentIdx ? 'text-foreground font-semibold' : 'text-muted',
              )}
            >
              {formatPhaseLabel(phase)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
