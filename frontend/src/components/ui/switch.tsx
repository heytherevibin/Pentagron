'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full',
      'border border-border-strong transition-colors duration-180',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=unchecked]:bg-bg-muted',
      'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-3 w-3 rounded-full bg-fg shadow-sm',
        'transition-transform duration-180 ease-out-quart',
        'data-[state=unchecked]:translate-x-[3px] data-[state=unchecked]:bg-fg-muted',
        'data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-accent-fg',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'
