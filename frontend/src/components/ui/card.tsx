'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Card — Vercel-style: bg-bg-subtle, 1px border, optional inner highlight,
 * 8px radius. Sub-components mirror shadcn so consumers can mix freely.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** When true, hover lifts the card subtly. */
    interactive?: boolean
    /** When true, an animated conic-gradient border traces the card. */
    featured?: boolean
  }
>(({ className, interactive, featured, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative rounded-md border border-border bg-bg-subtle ring-inset-hi',
      'transition-[transform,border,background] duration-180 ease-out-quart',
      interactive && 'hover:-translate-y-px hover:border-border-strong hover:bg-bg-muted/60 cursor-pointer',
      featured && 'conic-border',
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1 px-4 pt-4 pb-3', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm font-medium leading-tight tracking-tight text-fg', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-xs leading-relaxed text-fg-muted', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-4 pb-4', className)} {...props} />
))
CardContent.displayName = 'CardContent'

/**
 * SurfaceCard — a Card with the top-edge hairline highlight and elevation-1
 * shadow. Use for "premium" contexts: hero stats, command-palette entries,
 * approval sheet anchors. For normal content cards, keep plain <Card>.
 *
 * Composition: renders a <Card> and applies `.surface-hairline` + `shadow-elev-1`.
 * All Card props (interactive, featured, className, …) are forwarded as-is.
 */
export const SurfaceCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Card> & {
    /** Bump to elevation-2 for dropdown-like contexts. */
    elevation?: 1 | 2 | 3
    /** Swap the accent glow on (reserved for hero / "live" moments). */
    glow?: 'accent' | 'critical'
  }
>(({ className, elevation = 1, glow, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn(
      'surface-hairline',
      elevation === 1 && 'shadow-elev-1',
      elevation === 2 && 'shadow-elev-2',
      elevation === 3 && 'shadow-elev-3',
      glow === 'accent' && 'shadow-glow-accent',
      glow === 'critical' && 'shadow-glow-critical',
      className,
    )}
    {...props}
  />
))
SurfaceCard.displayName = 'SurfaceCard'

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between gap-2 px-4 py-3',
      'border-t border-border-subtle bg-bg/40 rounded-b-md',
      className,
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'
