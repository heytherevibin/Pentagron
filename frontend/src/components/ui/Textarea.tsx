import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="section-label">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            'w-full bg-surface-1 border border-border text-foreground font-mono text-xs px-3 py-2 resize-none',
            'placeholder:text-muted',
            'focus:outline-none focus:border-blue-500/50',
            error && 'border-red-500/50 focus:border-red-500/50',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-red-400 text-[11px] font-mono">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
