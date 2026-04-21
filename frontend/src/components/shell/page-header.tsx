'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * PageHeader — consistent title row at the top of authenticated pages.
 *
 *   [ ← back ]   Eyebrow
 *                Title              [ actions slot ]
 *                Subtitle / meta
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-2xs uppercase tracking-widest text-fg-subtle font-mono hover:text-fg transition-colors duration-120 mb-3"
          >
            <ChevronLeft className="h-3 w-3" />
            {backLabel ?? 'Back'}
          </Link>
        )}
        {eyebrow && (
          <div className="text-2xs uppercase tracking-widest text-accent font-mono mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl lg:text-3xl tracking-tighter font-medium text-fg truncate">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1.5 text-sm text-fg-muted">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

/** PageShell — outer wrapper that pins layout + padding for pages. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10 py-8 lg:py-10', className)}>
      {children}
    </div>
  )
}
