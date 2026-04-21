'use client'

import * as React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * SettingsCard — the repeating two-column "row" pattern used across every
 * settings subpage:
 *
 *   [ Title + description ]      [ Controls ]
 *
 * On narrow viewports the columns stack.
 */
export function SettingsCard({
  title,
  description,
  footer,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
        <CardHeader className="md:border-r md:border-b-0 border-b border-border-subtle bg-bg-subtle/30">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && (
            <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{description}</p>
          )}
        </CardHeader>
        <CardContent className="py-5">{children}</CardContent>
      </div>
      {footer && (
        <div className="border-t border-border-subtle bg-bg-subtle/40 px-6 py-3">
          {footer}
        </div>
      )}
    </Card>
  )
}
