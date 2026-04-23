'use client'

import * as React from 'react'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { MobileNav } from './mobile-nav'
import { CommandPaletteProvider } from './command-palette'

const COLLAPSE_KEY = 'pentagron_sidebar_collapsed'

/**
 * Shell — the authenticated application chrome.
 *
 *   [ Sidebar ] [ Topbar            ]
 *   [         ] [ main content area ]
 *
 * Responsibilities:
 *   • Sidebar collapse state (persisted to localStorage)
 *   • Mobile nav drawer
 *   • Command-palette provider (⌘K)
 *   • ⌘\ sidebar-toggle shortcut
 */
export function Shell({
  email,
  children,
}: {
  email?: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY)
      if (saved === '1') setCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  // ⌘\ — collapse/expand the sidebar.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCollapsed])

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen bg-bg text-fg">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar email={email} onOpenMobileNav={() => setMobileOpen(true)} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 min-w-0 focus:outline-none"
          >
            {children}
          </main>
        </div>
        <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
      </div>
    </CommandPaletteProvider>
  )
}
