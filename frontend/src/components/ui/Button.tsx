import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const VARIANT_STYLES = {
  primary: 'bg-mc-emerald text-mc-bg font-bold hover:bg-mc-emerald-dim active:bg-mc-emerald-dim',
  danger:  'bg-mc-crimson/20 border border-mc-crimson text-mc-crimson hover:bg-mc-crimson/30 active:bg-mc-crimson/40',
  ghost:   'bg-transparent text-mc-text-dim hover:bg-mc-surface-hover hover:text-mc-text',
  outline: 'bg-transparent border border-mc-border text-mc-text-dim hover:border-mc-border-bright hover:text-mc-text',
}

const SIZE_STYLES = {
  sm: 'px-2.5 py-1 text-xxs',
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
          'inline-flex items-center justify-center gap-1.5 font-mono uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="animate-blink">...</span>
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
