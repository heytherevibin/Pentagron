'use client'

import * as React from 'react'

export type Density = 'compact' | 'cozy'

const KEY = 'pentagron_density'

/**
 * useDensity — persisted (localStorage) density preference for tables/lists.
 * Defaults to 'compact' — our dense, ops-oriented baseline.
 */
export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensity] = React.useState<Density>('compact')

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(KEY)
      if (v === 'compact' || v === 'cozy') setDensity(v)
    } catch {
      /* ignore */
    }
  }, [])

  const update = React.useCallback((d: Density) => {
    setDensity(d)
    try {
      localStorage.setItem(KEY, d)
    } catch {
      /* ignore */
    }
  }, [])

  return [density, update]
}
