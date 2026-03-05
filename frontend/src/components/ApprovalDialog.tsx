'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { DataLabel } from '@/components/ui/DataLabel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import type { ApprovalRequest } from '@/types'

interface ApprovalDialogProps {
  approval: ApprovalRequest | null
  onApprove: (id: string, notes?: string) => void
  onReject: (id: string, notes?: string) => void
}

export default function ApprovalDialog({
  approval,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const [notes, setNotes] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [denying, setDenying] = useState(false)

  useEffect(() => {
    setNotes('')
    setDetailsOpen(false)
    setAuthorizing(false)
    setDenying(false)
  }, [approval?.id])

  const handleAuthorize = async () => {
    if (!approval) return
    setAuthorizing(true)
    try {
      onApprove(approval.id, notes || undefined)
      toast.success('Phase transition authorized')
    } catch {
      toast.error('Authorization failed')
    } finally {
      setAuthorizing(false)
    }
  }

  const handleDeny = async () => {
    if (!approval) return
    setDenying(true)
    try {
      onReject(approval.id, notes || undefined)
      toast.error('Phase transition denied')
    } catch {
      toast.error('Rejection failed')
    } finally {
      setDenying(false)
    }
  }

  return (
    <Dialog.Root open={approval !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />

        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface-1 border border-amber-500/40 max-w-md w-full p-6 font-mono focus:outline-none"
        >
          <Dialog.Title asChild>
            <DataLabel className="text-amber-400 text-xs tracking-wider">
              PHASE TRANSITION AUTHORIZATION
            </DataLabel>
          </Dialog.Title>

          <Dialog.Description className="sr-only">
            Approve or deny the requested phase transition.
          </Dialog.Description>

          <div className="mt-4">
            <StatusBadge status={approval?.phase ?? 'recon'} variant="phase" />
          </div>

          <p className="mt-3 text-muted text-sm font-mono leading-relaxed">
            {approval?.description ?? 'No description provided.'}
          </p>

          {approval?.payload && (
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="text-[10px] font-mono text-muted hover:text-foreground transition-colors uppercase tracking-wider"
              >
                {detailsOpen ? 'hide details' : 'show details'}
              </button>
              {detailsOpen && (
                <pre className="bg-background border border-border p-3 text-[10px] font-mono text-muted overflow-auto max-h-32">
                  <code>{JSON.stringify(approval.payload, null, 2)}</code>
                </pre>
              )}
            </div>
          )}

          <div className="mt-4 space-y-1">
            <label
              htmlFor="approval-notes"
              className="block text-[10px] font-mono text-muted uppercase tracking-wider"
            >
              operator notes
            </label>
            <textarea
              id="approval-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional notes..."
              className="w-full bg-background border border-border p-2 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={handleAuthorize}
              disabled={authorizing || denying}
              className="flex-1"
            >
              {authorizing ? 'Authorizing...' : 'Authorize'}
            </Button>
            <Button
              onClick={handleDeny}
              disabled={authorizing || denying}
              variant="danger"
              className="flex-1"
            >
              {denying ? 'Denying...' : 'Deny'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
