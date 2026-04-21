import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn — className composer.
 * Combines clsx's conditional class API with tailwind-merge's last-wins
 * resolution for conflicting Tailwind utilities.
 *
 * @example
 *   cn('px-2 py-1', condition && 'px-4', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Sleep for `ms` milliseconds. Used in micro-interactions and tests. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Formats a Date / ISO string as `MMM DD, HH:mm`. */
export function formatDateTime(input: string | Date | undefined | null): string {
  if (!input) return '—'
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Compact relative time — "12s ago", "3m ago", "2h ago", "4d ago". */
export function timeAgo(input: string | Date | undefined | null): string {
  if (!input) return '—'
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Truncate string to `n` chars with ellipsis. */
export function truncate(s: string, n = 64): string {
  if (!s) return ''
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/** Format a duration in milliseconds as `1.2s` / `345ms` / `2m 4s`. */
export function formatDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

/** Format a number with thousand separators. */
export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US').format(n)
}

/** Stable hash → 0..1, useful for deterministic animation seeds. */
export function hashToUnit(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000
}
