import { cn } from '@/lib/cn'
import { DataLabel } from './DataLabel'

interface StatCardProps {
  label: string
  value: number | string
  accent?: 'emerald' | 'crimson' | 'amber' | 'blue' | 'default'
  icon?: React.ReactNode
}

const ACCENT_BORDER: Record<string, string> = {
  emerald: 'border-l-mc-emerald',
  crimson: 'border-l-mc-crimson',
  amber:   'border-l-mc-amber',
  blue:    'border-l-mc-blue',
  default: 'border-l-mc-border-bright',
}

const ACCENT_TEXT: Record<string, string> = {
  emerald: 'text-mc-emerald',
  crimson: 'text-mc-crimson',
  amber:   'text-mc-amber',
  blue:    'text-mc-blue',
  default: 'text-mc-text',
}

export function StatCard({ label, value, accent = 'default', icon }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-mc-surface border border-mc-border border-l-4 p-4',
        ACCENT_BORDER[accent],
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={cn('text-3xl font-bold font-mono', ACCENT_TEXT[accent])}>
            {value}
          </div>
          <div className="mt-1">
            <DataLabel>{label}</DataLabel>
          </div>
        </div>
        {icon && (
          <span className="text-mc-text-ghost shrink-0">{icon}</span>
        )}
      </div>
    </div>
  )
}
