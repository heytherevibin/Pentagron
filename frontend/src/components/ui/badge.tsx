'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 whitespace-nowrap',
    'border font-medium leading-none',
    'transition-colors duration-120',
  ],
  {
    variants: {
      variant: {
        default:  'bg-bg-muted text-fg-muted border-border',
        accent:   'bg-accent/10 text-accent border-accent/25',
        success:  'bg-accent/10 text-accent border-accent/25',
        warning:  'bg-sev-medium/10 text-sev-medium border-sev-medium/25',
        danger:   'bg-sev-critical/10 text-sev-critical border-sev-critical/25',
        info:     'bg-sev-low/10 text-sev-low border-sev-low/25',
        outline:  'bg-transparent text-fg-muted border-border',
        ghost:    'bg-transparent text-fg-muted border-transparent',
        critical: 'bg-sev-critical/10 text-sev-critical border-sev-critical/25',
        high:     'bg-sev-high/10 text-sev-high border-sev-high/25',
        medium:   'bg-sev-medium/10 text-sev-medium border-sev-medium/25',
        low:      'bg-sev-low/10 text-sev-low border-sev-low/25',
      },
      size: {
        xs: 'h-4 px-1.5 text-[10px] rounded-sm gap-0.5',
        sm: 'h-5 px-1.5 text-2xs rounded',
        md: 'h-6 px-2 text-xs rounded',
        lg: 'h-7 px-2.5 text-xs rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  pulse?: boolean
}

export function Badge({ className, variant, size, dot, pulse, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span className="relative inline-flex shrink-0 items-center justify-center">
          {pulse && (
            <span
              className="absolute inline-flex h-2 w-2 rounded-full opacity-60 animate-ping"
              style={{ background: 'currentColor' }}
            />
          )}
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: 'currentColor' }}
          />
        </span>
      )}
      {children}
    </span>
  )
}

export { badgeVariants }
