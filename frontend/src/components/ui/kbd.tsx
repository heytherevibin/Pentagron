import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Kbd — keyboard shortcut chip. Multiple chips render as a row of pills.
 *
 *   <Kbd>⌘</Kbd><Kbd>K</Kbd>
 *   <Kbd combo>⌘K</Kbd>
 */
export function Kbd({
  className,
  combo,
  ...props
}: React.HTMLAttributes<HTMLElement> & { combo?: boolean }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center px-1.5',
        'rounded border border-border bg-bg-muted',
        'text-2xs font-medium text-fg-muted',
        'shadow-[inset_0_-1px_0_0_hsl(var(--border-strong))]',
        'font-mono leading-none',
        combo && 'gap-1 px-2',
        className,
      )}
      {...props}
    />
  )
}

/** Renders a row of single-char Kbd chips. `keys={['⌘', 'K']}`. */
export function KbdCombo({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((k, i) => (
        <Kbd key={`${k}-${i}`}>{k}</Kbd>
      ))}
    </span>
  )
}
