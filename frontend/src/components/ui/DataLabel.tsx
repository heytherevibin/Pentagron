import { cn } from '@/lib/cn'

interface DataLabelProps {
  children: React.ReactNode
  className?: string
}

export function DataLabel({ children, className }: DataLabelProps) {
  return (
    <span className={cn('text-[10px] font-medium text-muted uppercase tracking-widest-plus', className)}>
      {children}
    </span>
  )
}
