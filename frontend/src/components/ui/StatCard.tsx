import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: number | string
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple'
  icon?: React.ReactNode
}

const ACCENT_BORDER: Record<string, string> = {
  blue:    'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  amber:   'border-l-amber-500',
  red:     'border-l-red-500',
  purple:  'border-l-purple-500',
}

const ACCENT_TEXT: Record<string, string> = {
  blue:    'text-blue-400',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
  purple:  'text-purple-400',
}

export function StatCard({ label, value, accent = 'blue', icon }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-surface-1 border border-border border-l-[3px] p-5',
        ACCENT_BORDER[accent],
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={cn('text-3xl font-bold font-mono tracking-tight', ACCENT_TEXT[accent])}>
            {value}
          </div>
          <div className="mt-1.5">
            <span className="text-[10px] font-medium text-muted uppercase tracking-widest-plus">
              {label}
            </span>
          </div>
        </div>
        {icon && <span className="text-muted shrink-0">{icon}</span>}
      </div>
    </div>
  )
}
