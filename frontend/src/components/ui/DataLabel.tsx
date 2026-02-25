import { cn } from '@/lib/cn'

interface DataLabelProps {
  children: React.ReactNode
  className?: string
}

export function DataLabel({ children, className }: DataLabelProps) {
  return (
    <span className={cn('data-label', className)}>
      {children}
    </span>
  )
}
