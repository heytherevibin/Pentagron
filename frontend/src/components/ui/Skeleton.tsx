import { cn } from '@/lib/cn'

interface SkeletonProps {
  className?: string
  variant?: 'line' | 'card' | 'stat'
}

const VARIANT_STYLES: Record<string, string> = {
  line: 'h-4 bg-mc-border/50 animate-skeleton',
  card: 'h-24 bg-mc-surface border border-mc-border animate-skeleton',
  stat: 'h-20 bg-mc-surface border border-mc-border animate-skeleton',
}

export function Skeleton({ className, variant = 'line' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-[2px]',
        VARIANT_STYLES[variant],
        className,
      )}
    />
  )
}
