'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronsLeft, Plus, Search } from 'lucide-react'

import { Wordmark } from '@/components/ui/wordmark'
import { StatusDot } from '@/components/ui/status-dot'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { NAV_SECTIONS, type NavItem } from './nav-config'
import { useCommandPalette } from './command-palette'

/**
 * Sidebar — fixed 248px left rail.
 *
 *   [  Wordmark · collapse           ]
 *   [  ⌘K search trigger             ]
 *   [  Primary nav (grouped)         ]
 *   [                                ]
 *   [  Footer: version + status dot  ]
 *
 * The collapsed variant (56px) renders icon-only; tooltips supply labels.
 * On narrow viewports the sidebar hides entirely — the shell uses a Sheet
 * for mobile navigation.
 */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const pathname = usePathname() ?? '/'
  const { toggle: onOpenCommandPalette } = useCommandPalette()

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 248 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'hidden lg:flex shrink-0 flex-col h-screen sticky top-0',
        'border-r border-border bg-bg',
        'relative z-20',
      )}
    >
      {/* ── Header: wordmark + collapse ──────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center border-b border-border-subtle h-14 px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <Link
          href="/"
          aria-label="Pentagron · home"
          className="inline-flex items-center gap-2 group"
        >
          {collapsed ? (
            <span
              className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-subtle ring-inset-hi"
              aria-hidden
            >
              <span className="font-mono text-sm font-semibold tracking-tight text-fg">
                p
              </span>
              <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.7)]" />
            </span>
          ) : (
            <Wordmark className="text-lg" />
          )}
        </Link>
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-md',
                  'text-fg-subtle hover:text-fg hover:bg-bg-subtle',
                  'transition-colors duration-120',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                )}
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Collapse · <Kbd>⌘\</Kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Command trigger + new flow ───────────────────────────────────── */}
      <div className={cn('flex flex-col gap-1.5 px-3 py-3', collapsed && 'items-center')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className={cn(
                'group/cmd inline-flex items-center gap-2 h-8 rounded-md',
                'border border-border bg-bg-subtle/60 ring-inset-hi',
                'hover:bg-bg-muted hover:border-border-strong',
                'transition-colors duration-120',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                collapsed ? 'w-8 justify-center px-0' : 'w-full px-2.5 justify-between',
              )}
              aria-label="Open command palette"
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <Search className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                {!collapsed && (
                  <span className="text-xs text-fg-subtle truncate">Search…</span>
                )}
              </span>
              {!collapsed && (
                <span className="flex items-center gap-0.5 text-2xs text-fg-subtle font-mono">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </span>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" sideOffset={8}>
              Search · <Kbd>⌘K</Kbd>
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/projects/new"
              className={cn(
                'inline-flex items-center gap-2 h-8 rounded-md',
                'border border-border/80 bg-bg text-fg-muted',
                'hover:text-fg hover:bg-bg-subtle hover:border-border-strong',
                'transition-colors duration-120',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                collapsed ? 'w-8 justify-center px-0' : 'w-full px-2.5',
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && (
                <span className="text-xs">New project</span>
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" sideOffset={8}>New project</TooltipContent>
          )}
        </Tooltip>
      </div>

      <Separator className="mx-3 w-auto" />

      {/* ── Nav sections ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-5">
          {NAV_SECTIONS.map((section) => (
            <li key={section.label}>
              {!collapsed && (
                <div className="px-2 pb-1.5 text-2xs uppercase tracking-widest text-fg-subtle font-mono">
                  {section.label}
                </div>
              )}
              <ul className={cn('flex flex-col gap-0.5', collapsed && 'items-center')}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={item.match ? item.match(pathname) : pathname.startsWith(item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Footer: status strip ─────────────────────────────────────────── */}
      <div
        className={cn(
          'border-t border-border-subtle px-3 py-3',
          collapsed ? 'flex justify-center' : 'flex items-center justify-between',
        )}
      >
        <div className="flex items-center gap-2">
          <StatusDot tone="accent" pulse size={6} />
          {!collapsed && (
            <span className="text-2xs text-fg-subtle font-mono uppercase tracking-widest">
              v0.3.1 · online
            </span>
          )}
        </div>
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="absolute top-3 -right-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-bg-subtle text-fg-subtle hover:text-fg hover:border-border-strong transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55"
                aria-label="Expand sidebar"
              >
                <ChevronsLeft className="h-3 w-3 rotate-180" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Expand</TooltipContent>
          </Tooltip>
        )}
      </div>
    </motion.aside>
  )
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group/nav relative inline-flex items-center gap-2.5 rounded-md h-8',
        'transition-colors duration-120',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
        collapsed ? 'w-8 justify-center px-0' : 'w-full px-2.5',
        active
          ? 'bg-bg-subtle text-fg'
          : 'text-fg-muted hover:text-fg hover:bg-bg-subtle/60',
      )}
    >
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.6)]"
        />
      )}
      <Icon
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-colors duration-120',
          active ? 'text-accent' : 'text-fg-subtle group-hover/nav:text-fg-muted',
        )}
      />
      {!collapsed && (
        <span className="text-xs font-medium truncate">{item.label}</span>
      )}
    </Link>
  )

  if (!collapsed) return <li>{link}</li>

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    </li>
  )
}
