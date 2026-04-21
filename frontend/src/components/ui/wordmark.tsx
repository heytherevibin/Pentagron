import * as React from 'react'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/constants'

/**
 * Wordmark — the official pentagron mark.
 *
 * Letters set in Geist Mono lowercase. The `accentLetterIndex` letter is
 * underscored by a small Vercel-green dot. Sized in `em` so it scales with
 * its container's font-size.
 *
 *   <Wordmark className="text-xl" />   (default)
 *   <Wordmark className="text-3xl" />  (login hero)
 */
export function Wordmark({
  className,
  showDot = true,
}: {
  className?: string
  showDot?: boolean
}) {
  const letters = BRAND.name.split('')
  const accentIdx = BRAND.accentLetterIndex

  return (
    <span
      className={cn(
        'relative inline-flex items-baseline font-mono tracking-tight font-medium',
        'text-fg select-none',
        className,
      )}
      aria-label={BRAND.name}
    >
      {letters.map((ch, i) => (
        <span key={i} className="relative inline-block leading-none">
          {ch}
          {showDot && i === accentIdx && (
            <span
              aria-hidden
              className={cn(
                'absolute left-1/2 -translate-x-1/2',
                '-bottom-[0.18em] h-[0.18em] w-[0.18em] rounded-full',
                'bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.7)]',
              )}
            />
          )}
        </span>
      ))}
    </span>
  )
}
