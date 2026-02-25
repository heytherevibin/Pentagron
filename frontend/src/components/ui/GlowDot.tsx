import { cn } from '@/lib/cn'

type DotStatus = 'ok' | 'error' | 'warning' | 'info' | 'offline' | 'running'

interface GlowDotProps {
  status: DotStatus
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  className?: string
}

const STATUS_STYLES: Record<DotStatus, string> = {
  ok:      'bg-mc-emerald glow-emerald',
  error:   'bg-mc-crimson glow-crimson',
  warning: 'bg-mc-amber glow-amber',
  info:    'bg-mc-blue glow-blue',
  offline: 'bg-mc-text-ghost',
  running: 'bg-mc-blue glow-blue animate-pulse',
}

const SIZE_MAP = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

export function GlowDot({ status, size = 'md', pulse, className }: GlowDotProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        SIZE_MAP[size],
        STATUS_STYLES[status],
        pulse && 'animate-pulse',
        className,
      )}
    />
  )
}
