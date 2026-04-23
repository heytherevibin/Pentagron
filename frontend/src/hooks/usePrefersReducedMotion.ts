'use client'

import * as React from 'react'

/**
 * Returns true when the user has requested reduced motion (either OS-level
 * or via the prefers-reduced-motion media query). Re-subscribes on change.
 *
 * Use this to gate spring physics, decorative animations, and anything
 * driven by framer-motion — CSS `transition-*` / `animation-*` are already
 * neutralised by the global `@media (prefers-reduced-motion: reduce)` reset
 * in `globals.css`.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}
