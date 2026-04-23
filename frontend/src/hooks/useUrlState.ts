'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * useUrlState — two-way binding between a key in the URL query string and
 * local React state, without triggering full page navigations.
 *
 * Usage:
 *   const [status, setStatus] = useUrlState('status', 'all')
 *
 * - Reads the current value from `?status=…` on every render.
 * - Writes back via router.replace so the URL changes without a scroll reset.
 * - Omits the param entirely when value equals the default (keeps URLs clean).
 */
export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get(key)
  const value = (raw ?? defaultValue) as T

  const set = React.useCallback(
    (next: T) => {
      const sp = new URLSearchParams(params.toString())
      if (!next || next === defaultValue) sp.delete(key)
      else sp.set(key, next)
      const q = sp.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [params, key, defaultValue, router, pathname],
  )

  return [value, set]
}

/**
 * useUrlStateMulti — same pattern, but for a group of keys, batched into a
 * single replace() call. Prevents re-renders from interfering when multiple
 * filters change at once.
 */
export function useUrlStateMulti<T extends Record<string, string>>(
  defaults: T,
): [T, (next: Partial<T>) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const value = React.useMemo(() => {
    const out = { ...defaults }
    for (const k of Object.keys(defaults)) {
      const v = params.get(k)
      if (v !== null) (out as Record<string, string>)[k] = v
    }
    return out
  }, [params, defaults])

  const set = React.useCallback(
    (next: Partial<T>) => {
      const sp = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined) continue
        if (!v || v === (defaults as Record<string, string>)[k]) sp.delete(k)
        else sp.set(k, String(v))
      }
      const q = sp.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [params, defaults, router, pathname],
  )

  return [value, set]
}
