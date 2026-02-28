import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="section-label">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full h-9 bg-surface-1 border border-border text-foreground font-mono text-xs px-3',
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

Input.displayName = 'Input'
