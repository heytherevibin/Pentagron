import { cn } from '@/lib/cn'
import { DataLabel } from './DataLabel'

interface PanelProps {
  children: React.ReactNode
  title?: string
  icon?: React.ReactNode
  headerRight?: React.ReactNode
  variant?: 'default' | 'inset' | 'outlined'
  className?: string
  contentClassName?: string
}

const VARIANT_STYLES = {
  default:  'bg-mc-surface border border-mc-border',
  inset:    'bg-mc-bg border border-mc-border',
  outlined: 'bg-transparent border border-mc-border',
}

export function Panel({
  children,
  title,
  icon,
  headerRight,
  variant = 'default',
  className,
  contentClassName,
}: PanelProps) {
  return (
    <div className={cn(VARIANT_STYLES[variant], className)}>
      {title ? (
        <>
          <div className="flex items-center justify-between border-b border-mc-border p-3">
            <div className="flex items-center gap-2">
              {icon && <span className="text-mc-text-dim shrink-0">{icon}</span>}
              <DataLabel>{title}</DataLabel>
            </div>
            {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
          </div>
          <div className={cn('p-4', contentClassName)}>{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  )
}
