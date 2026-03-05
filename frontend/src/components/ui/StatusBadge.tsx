import { cn } from '@/lib/cn'

interface StatusBadgeProps {
  status: string
  variant?: 'flow' | 'severity' | 'phase'
  className?: string
}

const FLOW_STYLES: Record<string, string> = {
  pending:   'badge-neutral',
  running:   'badge-info',
  paused:    'badge-warning',
  completed: 'badge-positive',
  failed:    'badge-negative',
  cancelled: 'badge-neutral',
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'severity-critical',
  high:     'severity-high',
  medium:   'severity-medium',
  low:      'severity-low',
  info:     'severity-info',
}

const PHASE_STYLES: Record<string, string> = {
<<<<<<< HEAD
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
=======
  recon:              'badge-info',
  analysis:           'badge-purple',
  exploitation:       'badge-negative',
  post_exploitation:  'badge-warning',
  reporting:          'badge-positive',
  cleanup:            'badge-neutral',
>>>>>>> 40e84f4b2da7f71c5441224a1b666decf4dd5066
}

function getVariantStyle(status: string, variant: 'flow' | 'severity' | 'phase'): string {
  switch (variant) {
    case 'flow':     return FLOW_STYLES[status] ?? 'badge-neutral'
    case 'severity': return SEVERITY_STYLES[status] ?? 'severity-info'
    case 'phase':    return PHASE_STYLES[status] ?? 'badge-neutral'
  }
}

export function StatusBadge({ status, variant = 'flow', className }: StatusBadgeProps) {
  return (
    <span className={cn('badge', getVariantStyle(status, variant), className)}>
      {variant === 'flow' && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            status === 'completed' && 'bg-emerald-400',
            status === 'running' && 'bg-blue-400 animate-pulse',
            status === 'paused' && 'bg-amber-400',
            status === 'failed' && 'bg-red-400',
            status === 'cancelled' && 'bg-neutral-400',
            status === 'pending' && 'bg-neutral-500',
          )}
        />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  )
}
