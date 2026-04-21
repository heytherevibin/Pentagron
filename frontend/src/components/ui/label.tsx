'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { hint?: React.ReactNode }
>(({ className, children, hint, ...props }, ref) => (
  <div className="flex items-center justify-between">
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'text-xs font-medium leading-none text-fg-muted',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </LabelPrimitive.Root>
    {hint ? <span className="text-2xs text-fg-subtle font-mono">{hint}</span> : null}
  </div>
))
Label.displayName = 'Label'
