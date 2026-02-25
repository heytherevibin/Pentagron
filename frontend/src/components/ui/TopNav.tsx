'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import { GlowDot } from './GlowDot'

interface TopNavProps {
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
}

export function TopNav({ breadcrumbs, actions }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-40 w-full bg-mc-surface border-b border-mc-border border-t-2 border-t-mc-emerald h-12 flex items-center justify-between px-4 font-mono">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Link href="/" className="text-mc-emerald font-bold shrink-0 hover:opacity-80 transition-opacity">
          [PEN]
        </Link>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <>
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-2 min-w-0">
                <span className="text-mc-text-ghost shrink-0">/</span>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-mc-text-dim hover:text-mc-text transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-mc-text-dim truncate">{crumb.label}</span>
                )}
              </span>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <button
          className="text-mc-text-ghost text-xs font-mono px-2 py-1 border border-mc-border hover:border-mc-border-bright hover:text-mc-text-dim transition-colors"
          aria-label="Command palette"
        >
          &#8984;K
        </button>
        <Link
          href="/settings"
          className="text-mc-text-ghost hover:text-mc-text-dim transition-colors text-xs uppercase tracking-wider"
        >
          Settings
        </Link>
        <GlowDot status="ok" size="sm" />
      </div>
    </nav>
  )
}
