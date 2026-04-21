'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Button — Vercel-style. Tight 6px radius, hairline borders, sub-200ms
 * transitions, subtle inner highlight. Variants:
 *
 *   primary  — green accent CTA (sparingly)
 *   secondary— hairline outline on bg-subtle
 *   ghost    — transparent, hover surface
 *   outline  — same as secondary but on bare bg
 *   danger   — destructive actions
 *   link     — text-only, underline on hover
 */
const buttonVariants = cva(
  [
    'group/btn relative inline-flex items-center justify-center gap-2 select-none whitespace-nowrap',
    'font-medium leading-none',
    'transition-[background,border,color,box-shadow,transform] duration-120 ease-out-quart',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-[0.5px]',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-accent text-accent-fg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)]',
          'hover:bg-accent-hover',
          'data-[loading=true]:bg-accent-hover',
        ],
        secondary: [
          'bg-bg-subtle text-fg border border-border ring-inset-hi',
          'hover:bg-bg-muted hover:border-border-strong',
        ],
        outline: [
          'bg-transparent text-fg border border-border',
          'hover:bg-bg-subtle hover:border-border-strong',
        ],
        ghost: [
          'bg-transparent text-fg-muted',
          'hover:bg-bg-subtle hover:text-fg',
        ],
        danger: [
          'bg-sev-critical/10 text-sev-critical border border-sev-critical/30',
          'hover:bg-sev-critical/20 hover:border-sev-critical/50',
        ],
        link: [
          'bg-transparent text-fg underline-offset-4',
          'hover:underline hover:text-accent',
          'h-auto p-0 rounded-none',
        ],
      },
      size: {
        xs:   'h-6 px-2 text-xs rounded-sm gap-1',
        sm:   'h-7 px-2.5 text-xs rounded',
        md:   'h-8 px-3 text-sm rounded',
        lg:   'h-10 px-4 text-sm rounded-md',
        xl:   'h-11 px-5 text-base rounded-md',
        icon: 'h-8 w-8 rounded',
        'icon-sm': 'h-7 w-7 rounded',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        data-loading={loading || undefined}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : leftIcon ? (
          <span className="-ml-0.5 inline-flex shrink-0 items-center [&_svg]:h-3.5 [&_svg]:w-3.5">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon ? (
          <span className="-mr-0.5 inline-flex shrink-0 items-center [&_svg]:h-3.5 [&_svg]:w-3.5">{rightIcon}</span>
        ) : null}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
