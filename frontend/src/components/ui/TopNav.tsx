'use client'

import Link from 'next/link'
import { GlowDot } from './GlowDot'

interface TopNavProps {
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
}

export function TopNav({ breadcrumbs, actions }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-40 w-full bg-surface-1 border-b border-border border-t-2 border-t-blue-500 h-12 flex items-center justify-between px-4 font-mono">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Link href="/" className="text-blue-500 font-bold shrink-0 hover:opacity-80 transition-opacity">
          [P]
        </Link>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <>
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-2 min-w-0">
                <span className="text-muted shrink-0">/</span>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-muted hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-muted truncate">{crumb.label}</span>
                )}
              </span>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <button
          className="text-muted text-xs font-mono px-2 py-1 border border-border hover:border-surface-3 hover:text-foreground transition-colors"
          aria-label="Command palette"
        >
          &#8984;K
        </button>
        <Link
          href="/settings"
          className="text-muted hover:text-foreground transition-colors text-xs uppercase tracking-wider"
        >
          Settings
        </Link>
        <GlowDot status="ok" size="sm" />
      </div>
    </nav>
  )
}
