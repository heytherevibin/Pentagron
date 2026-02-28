import { cn } from '@/lib/cn'

interface PanelProps {
  children: React.ReactNode
  title?: string
  icon?: React.ReactNode
  headerRight?: React.ReactNode
  className?: string
  contentClassName?: string
}

export function Panel({
  children,
  title,
  icon,
  headerRight,
  className,
  contentClassName,
}: PanelProps) {
  return (
    <div className={cn('panel', className)}>
      {title ? (
        <>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              {icon && <span className="text-muted shrink-0">{icon}</span>}
              <span className="panel-header-text">{title}</span>
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
