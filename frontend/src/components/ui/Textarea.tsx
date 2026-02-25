import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { DataLabel } from './DataLabel'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <DataLabel>{label}</DataLabel>}
        <textarea
          ref={ref}
          className={cn(
            'w-full bg-mc-bg border border-mc-border text-mc-text font-mono text-sm px-3 py-2 resize-none',
            'placeholder:text-mc-text-ghost',
            'focus:border-mc-emerald focus:outline-none',
            error && 'border-mc-crimson focus:border-mc-crimson',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-mc-crimson text-xxs font-mono">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
