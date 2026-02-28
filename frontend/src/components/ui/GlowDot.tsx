import { cn } from '@/lib/cn'

type DotStatus = 'ok' | 'error' | 'warning' | 'info' | 'offline' | 'running'

interface GlowDotProps {
  status: DotStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const STATUS_STYLES: Record<DotStatus, string> = {
  ok:      'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
  error:   'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]',
  warning: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]',
  info:    'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]',
  offline: 'bg-neutral-600',
  running: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)] animate-pulse',
}

const SIZE_MAP = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

export function GlowDot({ status, size = 'md', className }: GlowDotProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        SIZE_MAP[size],
        STATUS_STYLES[status],
        className,
      )}
    />
  )
}
