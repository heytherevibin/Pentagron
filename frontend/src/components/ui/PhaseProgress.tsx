import type { FlowStatus } from '@/types'
import { cn } from '@/lib/cn'

interface PhaseProgressProps {
  currentPhase: string
  status: FlowStatus
  compact?: boolean
}

const PHASES = ['recon', 'analysis', 'exploitation', 'post_exploitation', 'reporting', 'cleanup'] as const

function getSegmentStyle(
  phase: string,
  currentPhase: string,
  status: FlowStatus,
): string {
  const currentIdx = PHASES.indexOf(currentPhase as typeof PHASES[number])
  const phaseIdx = PHASES.indexOf(phase as typeof PHASES[number])

  if (phaseIdx < currentIdx) {
    return 'bg-mc-emerald'
  }

  if (phaseIdx === currentIdx) {
    if (status === 'running') return 'bg-mc-blue animate-pulse'
    if (status === 'paused') return 'bg-mc-amber'
    return 'bg-mc-amber'
  }

  return 'bg-mc-border'
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
        <div className="flex gap-px mt-1.5">
          {PHASES.map((phase, idx) => (
            <span
              key={phase}
              className={cn(
                'flex-1 text-xxs font-mono uppercase tracking-widest-plus text-center',
                idx === currentIdx ? 'text-mc-text' : 'text-mc-text-ghost',
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
