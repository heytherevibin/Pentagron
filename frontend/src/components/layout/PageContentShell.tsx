'use client'

import { cn } from '@/lib/cn'

const INNER_CLASS =
  'w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border'
const INNER_CLASS_FULL_WIDTH = 'w-full mx-auto px-4 py-6 sm:px-6 space-y-6 box-border'

interface PageContentShellProps {
  children: React.ReactNode
  /** Outer wrapper: default min-h-screen dot-grid. Use centered for empty/landing. */
  variant?: 'default' | 'centered' | 'surface' | 'fullHeight'
  /** When true (and variant is fullHeight), inner has no max-width so content uses full viewport width. */
  fullWidth?: boolean
  /** Inner container class overrides (e.g. flex-1 min-h-0 for flow page). */
  innerClassName?: string
  className?: string
}

export function PageContentShell({
  children,
  variant = 'default',
  fullWidth = false,
  innerClassName,
  className,
}: PageContentShellProps) {
  const outerClass = cn(
    'min-h-screen dot-grid',
    variant === 'centered' &&
      'flex flex-col items-center justify-center p-8',
    variant === 'surface' && 'bg-surface-1',
    variant === 'fullHeight' && 'flex flex-col',
    variant === 'fullHeight' && fullWidth && 'w-full',
    className
  )

  const baseInner = variant === 'fullHeight' && fullWidth
    ? INNER_CLASS_FULL_WIDTH
    : INNER_CLASS
  const innerClassApplied =
    variant === 'fullHeight'
      ? cn(baseInner, 'flex flex-col flex-1 min-h-0', innerClassName)
      : cn(baseInner, innerClassName)

  return (
    <div className={outerClass}>
      <div className={innerClassApplied}>{children}</div>
    </div>
  )
}
