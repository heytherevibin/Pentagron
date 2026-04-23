'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, Search } from 'lucide-react'

import { Kbd } from '@/components/ui/kbd'
import { Wordmark } from '@/components/ui/wordmark'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import { UserMenu } from './user-menu'
import { useCommandPalette } from './command-palette'
import { NAV_ITEMS } from './nav-config'
import { Notifications } from './notifications'
import { ThemeToggle } from './theme-toggle'

/**
 * Topbar — 56px high, sticky. Composition:
 *
 *   [☰ mobile]  [  breadcrumbs  ]        [⌘K trigger] [separator] [user]
 */
export function Topbar({
  email,
  onOpenMobileNav,
}: {
  email?: string
  onOpenMobileNav: () => void
}) {
  const pathname = usePathname() ?? '/'
  const { toggle: openPalette } = useCommandPalette()
  const crumbs = React.useMemo(() => buildCrumbs(pathname), [pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-14 shrink-0',
        'border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70',
        'flex items-center gap-3 px-4 lg:px-6',
        // honour iOS notch when run as an installed PWA
        'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]',
      )}
    >
      {/* Mobile — hamburger + wordmark */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-subtle text-fg-muted hover:text-fg hover:border-border-strong transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 active:scale-95"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link href="/" aria-label="Pentagron" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 rounded">
          <Wordmark className="text-lg" />
        </Link>
      </div>

      {/* Breadcrumbs — surface from `md:` (tablet) with overflow-safe truncation. */}
      <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 min-w-0 overflow-hidden">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <React.Fragment key={c.href}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-fg-subtle shrink-0" aria-hidden />}
              {last ? (
                <span className="text-xs font-medium text-fg truncate">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className="text-xs text-fg-muted hover:text-fg transition-colors duration-120 truncate"
                >
                  {c.label}
                </Link>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Command trigger — compact icon on narrow, full pill on sm+ */}
      <button
        type="button"
        onClick={openPalette}
        className={cn(
          'inline-flex items-center gap-2 h-9 sm:h-8 rounded-md',
          'border border-border bg-bg-subtle/60 ring-inset-hi',
          'hover:bg-bg-muted hover:border-border-strong',
          'transition-colors duration-120',
          // Square on mobile (40×40 touch target), pill on sm+
          'w-9 sm:w-auto justify-center sm:justify-start px-0 sm:px-2.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
        )}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-fg-subtle" />
        <span className="hidden sm:inline text-xs text-fg-subtle">Search</span>
        <span className="hidden md:flex items-center gap-0.5 ml-6">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <Notifications />
      <ThemeToggle />

      <Separator orientation="vertical" className="h-5 hidden sm:block" />

      <UserMenu email={email} />
    </header>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

type Crumb = { label: string; href: string }

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === '/') return [{ label: 'Dashboard', href: '/' }]

  const parts = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = [{ label: 'Pentagron', href: '/' }]

  let acc = ''
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    acc += `/${seg}`
    crumbs.push({ label: labelFor(seg, acc), href: acc })
  }
  return crumbs
}

function labelFor(seg: string, href: string): string {
  const nav = NAV_ITEMS.find((n) => n.href === href)
  if (nav) return nav.label
  // UUIDs / ids — show a shortened form.
  if (/^[0-9a-f-]{12,}$/i.test(seg)) return seg.slice(0, 8) + '…'
  if (seg === 'new') return 'New'
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
}
