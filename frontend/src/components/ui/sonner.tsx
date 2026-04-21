'use client'

import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

/**
 * Sonner — preconfigured for the Pentagron dark theme.
 *
 * Mounted once in the root layout. Use `import { toast } from 'sonner'`
 * anywhere in the app to show notifications.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      richColors={false}
      closeButton
      offset={16}
      gap={8}
      visibleToasts={5}
      duration={4000}
      toastOptions={{
        classNames: {
          toast: [
            'group toast pointer-events-auto',
            'flex items-center gap-3 w-full',
            'rounded-md border border-border-strong bg-bg-elevated text-fg',
            'px-4 py-3 text-sm shadow-pop ring-inset-hi',
          ].join(' '),
          title:       'text-sm font-medium text-fg leading-tight',
          description: 'text-xs text-fg-muted leading-relaxed mt-0.5',
          actionButton:[
            'inline-flex h-7 items-center px-2.5 rounded text-xs font-medium',
            'bg-accent text-accent-fg hover:bg-accent-hover',
            'transition-colors duration-120',
          ].join(' '),
          cancelButton:[
            'inline-flex h-7 items-center px-2.5 rounded text-xs font-medium',
            'bg-bg-muted text-fg-muted hover:bg-bg-elevated hover:text-fg',
            'transition-colors duration-120',
          ].join(' '),
          closeButton: [
            'border border-border bg-bg-subtle text-fg-muted',
            'hover:bg-bg-muted hover:text-fg hover:border-border-strong',
          ].join(' '),
          success: '[&_[data-icon]]:text-accent',
          error:   '[&_[data-icon]]:text-sev-critical',
          warning: '[&_[data-icon]]:text-sev-medium',
          info:    '[&_[data-icon]]:text-sev-low',
        },
      }}
      {...props}
    />
  )
}
