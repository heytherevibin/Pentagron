'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'flex w-full bg-bg-muted text-fg placeholder:text-fg-subtle',
    'border border-border ring-inset-hi',
    'transition-[border,box-shadow] duration-120',
    'focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/15',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'autofill:bg-bg-muted',
  ],
  {
    variants: {
      size: {
        sm: 'h-7 px-2 text-xs rounded',
        md: 'h-8 px-3 text-sm rounded',
        lg: 'h-10 px-3.5 text-sm rounded-md',
        xl: 'h-11 px-4 text-base rounded-md',
      },
      invalid: {
        true: 'border-sev-critical/55 focus-visible:border-sev-critical/70 focus-visible:ring-sev-critical/15',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  containerClassName?: string
}

/**
 * Input — Vercel-style. 1px hairline, accent ring on focus, inner highlight.
 * Slots add icon affordances without breaking the form-control contract.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, size, invalid, leftSlot, rightSlot, ...props }, ref) => {
    if (!leftSlot && !rightSlot) {
      return <input ref={ref} className={cn(inputVariants({ size, invalid }), className)} {...props} />
    }

    return (
      <div
        className={cn(
          'group relative flex items-center w-full',
          containerClassName,
        )}
      >
        {leftSlot && (
          <span className="pointer-events-none absolute left-2.5 inline-flex items-center text-fg-subtle [&_svg]:h-3.5 [&_svg]:w-3.5">
            {leftSlot}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            inputVariants({ size, invalid }),
            leftSlot && 'pl-8',
            rightSlot && 'pr-8',
            className,
          )}
          {...props}
        />
        {rightSlot && (
          <span className="absolute right-2.5 inline-flex items-center text-fg-subtle [&_svg]:h-3.5 [&_svg]:w-3.5">
            {rightSlot}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

/* ── Textarea ────────────────────────────────────────────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full min-h-[80px] bg-bg-muted text-fg placeholder:text-fg-subtle',
        'border border-border ring-inset-hi rounded',
        'px-3 py-2 text-sm leading-relaxed resize-y',
        'transition-[border,box-shadow] duration-120',
        'focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/15',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid && 'border-sev-critical/55 focus-visible:border-sev-critical/70 focus-visible:ring-sev-critical/15',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
