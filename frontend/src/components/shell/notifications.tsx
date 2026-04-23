'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Bell,
  BellOff,
  CheckCheck,
  ShieldCheck,
  AlertTriangle,
  CircleCheck,
  CircleX,
  Sparkles,
  Radio,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { notifications } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'
import type { NotificationItem, NotificationKind } from '@/types'

const KIND_META: Record<NotificationKind, { icon: React.ElementType; color: string; label: string }> = {
  approval_request: { icon: ShieldCheck, color: 'text-accent', label: 'Approval' },
  flow_completed:   { icon: CircleCheck,  color: 'text-accent', label: 'Flow complete' },
  flow_failed:      { icon: CircleX,      color: 'text-sev-critical', label: 'Flow failed' },
  finding_critical: { icon: AlertTriangle,color: 'text-sev-critical', label: 'Critical finding' },
  finding_high:     { icon: AlertTriangle,color: 'text-sev-high',     label: 'High finding' },
  system:           { icon: Radio,        color: 'text-fg-muted',     label: 'System' },
  mention:          { icon: Sparkles,     color: 'text-sev-low',      label: 'Mention' },
}

type ApiShape = { items?: NotificationItem[]; unread_count?: number }

/**
 * Notifications — bell icon + dropdown list.
 *
 * Data source:
 *   1. SWR polls /api/notifications every 30s for the unread list (degrades
 *      gracefully to an empty list if the endpoint isn't shipped yet).
 *   2. WebSocket bridges (agent stream) can push into the same cache via
 *      `mutate` — see `useAgentWebSocket` consumers.
 *
 * UX rules:
 *   - Unread count badge caps at 99+.
 *   - Clicking a notification with an href navigates + marks-as-read.
 *   - "Mark all read" and "Clear" actions live in the popover header.
 */
export function Notifications() {
  const [open, setOpen] = React.useState(false)

  const { data, isLoading, mutate } = useSWR<ApiShape>(
    '/api/notifications?limit=25',
    async () => {
      try {
        const r = await notifications.list({ limit: 25 })
        return r.data as ApiShape
      } catch {
        // Backend hasn't shipped the endpoint yet — surface empty state.
        return { items: [], unread_count: 0 }
      }
    },
    { refreshInterval: 30_000, revalidateOnFocus: true },
  )

  const items = data?.items ?? []
  const unread = data?.unread_count ?? items.filter((i) => !i.read_at).length

  const handleMarkAll = async () => {
    try {
      await notifications.markAllRead()
    } catch {
      /* optimistic */
    }
    await mutate(
      (curr) =>
        curr
          ? {
              ...curr,
              items: (curr.items ?? []).map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })),
              unread_count: 0,
            }
          : curr,
      { revalidate: false },
    )
  }

  const handleClear = async () => {
    try {
      await notifications.clear()
    } catch {
      /* optimistic */
    }
    await mutate({ items: [], unread_count: 0 }, { revalidate: false })
  }

  const handleClick = async (n: NotificationItem) => {
    if (n.read_at) return
    try {
      await notifications.markRead(n.id)
    } catch {
      /* optimistic */
    }
    await mutate(
      (curr) =>
        curr
          ? {
              ...curr,
              items: (curr.items ?? []).map((i) =>
                i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i,
              ),
              unread_count: Math.max(0, (curr.unread_count ?? 1) - 1),
            }
          : curr,
      { revalidate: false },
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread ? ` — ${unread} unread` : ''}`}
          className={cn(
            'relative inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md',
            'border border-border bg-bg-subtle/60 ring-inset-hi',
            'text-fg-subtle hover:text-fg hover:bg-bg-muted hover:border-border-strong',
            'transition-colors duration-120',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
          )}
        >
          <Bell className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          {unread > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 inline-flex items-center justify-center',
                'h-4 min-w-[16px] px-1 rounded-full text-[9px] font-mono font-semibold',
                'bg-accent text-accent-fg ring-2 ring-bg',
              )}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-3 h-10">
          <div className="flex items-center gap-2 text-xs font-medium text-fg">
            <span>Notifications</span>
            {unread > 0 && (
              <span className="meta-mono text-accent">{unread} new</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-2xs font-mono uppercase tracking-wider text-fg-subtle hover:text-fg"
              onClick={handleMarkAll}
              disabled={unread === 0}
              title="Mark all read"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all
            </Button>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[min(70vh,440px)]">
          {isLoading ? (
            <div className="p-3 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Skeleton className="h-6 w-6 rounded-md shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-56 mt-1.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle">
                <BellOff className="h-4 w-4 text-fg-subtle" />
              </div>
              <div>
                <div className="text-xs font-medium text-fg">You&apos;re all caught up</div>
                <div className="mt-1 text-2xs text-fg-subtle">
                  New approvals, findings, and flow status land here in real time.
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle/60">
              {items.map((n) => (
                <NotificationRow key={n.id} n={n} onActivate={() => handleClick(n)} />
              ))}
            </ul>
          )}
        </ScrollArea>

        {/* Footer */}
        {items.length > 0 && (
          <div className="flex items-center justify-between border-t border-border-subtle px-3 h-9">
            <Link
              href="/activity"
              onClick={() => setOpen(false)}
              className="text-2xs font-mono uppercase tracking-wider text-fg-subtle hover:text-fg transition-colors duration-120"
            >
              See all activity
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-2xs font-mono uppercase tracking-wider text-fg-subtle hover:text-sev-critical"
              onClick={handleClear}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({
  n,
  onActivate,
}: {
  n: NotificationItem
  onActivate: () => void
}) {
  const meta = KIND_META[n.kind] ?? KIND_META.system
  const Icon = meta.icon
  const unread = !n.read_at

  const body = (
    <div
      className={cn(
        'relative flex items-start gap-2.5 px-3 py-2.5',
        'hover:bg-bg-muted/50 transition-colors duration-120 cursor-pointer',
      )}
      onClick={onActivate}
    >
      {unread && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-accent" />
      )}
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle shrink-0">
        <Icon className={cn('h-3.5 w-3.5', meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-xs truncate', unread ? 'text-fg font-medium' : 'text-fg-muted')}>
          {n.title}
        </div>
        {n.body && (
          <div className="text-2xs text-fg-subtle mt-0.5 line-clamp-2">{n.body}</div>
        )}
        <div className="meta-mono mt-1 flex items-center gap-1.5">
          <span>{meta.label}</span>
          <span className="text-fg-disabled">·</span>
          <span>{timeAgo(n.created_at)}</span>
        </div>
      </div>
    </div>
  )

  if (n.href) {
    return (
      <li>
        <Link href={n.href} className="block focus-ring">
          {body}
        </Link>
      </li>
    )
  }
  return <li>{body}</li>
}
