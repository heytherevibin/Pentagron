'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/cn'
import { DataLabel } from './DataLabel'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  variant?: 'danger' | 'warning'
  confirmLabel?: string
  onConfirm: () => void
  loading?: boolean
}

const BORDER_VARIANT: Record<string, string> = {
  danger:  'border-mc-crimson',
  warning: 'border-mc-amber',
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'danger',
  confirmLabel = 'Confirm',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'bg-mc-surface border',
            BORDER_VARIANT[variant],
          )}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="p-4 border-b border-mc-border">
            <Dialog.Title asChild>
              <DataLabel>{title}</DataLabel>
            </Dialog.Title>
          </div>

          <div className="p-4">
            <Dialog.Description className="text-mc-text-dim text-sm font-mono">
              {description}
            </Dialog.Description>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-mc-border">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="sm"
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
