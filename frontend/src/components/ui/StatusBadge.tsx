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
  recon:              'badge-info',
  analysis:           'badge-purple',
  exploitation:       'badge-negative',
  post_exploitation:  'badge-warning',
  reporting:          'badge-positive',
  cleanup:            'badge-neutral',
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
