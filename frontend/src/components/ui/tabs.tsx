'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Horizontal scroll on narrow viewports so long tab lists never clip
      // or wrap awkwardly. `scrollbar-none` is CSS-hidden, swipe still works.
      'relative flex h-9 items-center gap-1 border-b border-border',
      'max-w-full overflow-x-auto overflow-y-hidden',
      '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center gap-1.5 h-9 px-3 shrink-0',
      'text-sm font-medium text-fg-muted whitespace-nowrap',
      'transition-colors duration-120',
      'hover:text-fg',
      'data-[state=active]:text-fg',
      'after:absolute after:inset-x-2 after:bottom-[-1px] after:h-px',
      'after:bg-transparent data-[state=active]:after:bg-accent after:transition-colors after:duration-180',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 focus-visible:ring-offset-0',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 animate-fade-in',
      'focus-visible:outline-none',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'
