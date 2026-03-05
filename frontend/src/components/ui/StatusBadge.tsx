import { cn } from '@/lib/cn'
import { GlowDot } from './GlowDot'

interface StatusBadgeProps {
  status: string
  variant?: 'flow' | 'severity' | 'phase'
  className?: string
}

const FLOW_STYLES: Record<string, string> = {
  pending:   'bg-slate-800/60 text-slate-400',
  running:   'bg-blue-950/50 text-blue-400 animate-pulse',
  paused:    'bg-amber-950/50 text-amber-400',
  completed: 'bg-emerald-950/50 text-mc-emerald',
  failed:    'bg-red-950/50 text-mc-crimson',
  cancelled: 'bg-slate-800/40 text-mc-text-ghost',
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-950/50 text-mc-crimson',
  high:     'bg-red-950/40 text-red-400',
  medium:   'bg-amber-950/50 text-mc-amber',
  low:      'bg-blue-950/50 text-mc-blue',
  info:     'bg-slate-800/60 text-slate-400',
}

const PHASE_STYLES: Record<string, string> = {
  recon:              'bg-blue-950/50 text-blue-400',
  analysis:           'bg-indigo-950/50 text-indigo-400',
  exploitation:       'bg-red-950/50 text-mc-crimson',
  post_exploitation:  'bg-amber-950/50 text-mc-amber',
  reporting:          'bg-emerald-950/50 text-mc-emerald',
  cleanup:            'bg-slate-800/60 text-slate-400',
}

const FLOW_DOT_STATUS: Record<string, 'ok' | 'error' | 'warning' | 'info' | 'offline' | 'running'> = {
  pending:   'offline',
  running:   'running',
  paused:    'warning',
  completed: 'ok',
  failed:    'error',
  cancelled: 'offline',
}

function getVariantStyle(status: string, variant: 'flow' | 'severity' | 'phase'): string {
  switch (variant) {
    case 'flow':     return FLOW_STYLES[status] ?? FLOW_STYLES.pending
    case 'severity': return SEVERITY_STYLES[status] ?? SEVERITY_STYLES.info
    case 'phase':    return PHASE_STYLES[status] ?? PHASE_STYLES.recon
  }
}

export function StatusBadge({ status, variant = 'flow', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xxs font-mono uppercase tracking-wider',
        getVariantStyle(status, variant),
        className,
      )}
    >
      {variant === 'flow' && (
        <GlowDot status={FLOW_DOT_STATUS[status] ?? 'offline'} size="sm" />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  )
}
