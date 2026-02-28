import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const VARIANT_STYLES = {
  primary: 'bg-blue-600 text-white font-semibold hover:bg-blue-500',
  danger:  'text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20',
  ghost:   'bg-transparent text-muted hover:text-foreground hover:bg-surface-2',
  outline: 'bg-transparent border border-border text-muted hover:text-foreground hover:bg-surface-2',
}

const SIZE_STYLES = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-4 py-1.5 text-xs',
  lg: 'px-6 py-2 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-mono transition-colors',
          'disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed',
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="animate-pulse">Processing...</span>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
