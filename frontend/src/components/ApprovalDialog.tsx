'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { DataLabel } from '@/components/ui/DataLabel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { ApprovalRequest } from '@/types';

/* ─── props ─── */
interface ApprovalDialogProps {
  approval: ApprovalRequest | null;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, notes?: string) => void;
}

export default function ApprovalDialog({
  approval,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const [notes, setNotes] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [denying, setDenying] = useState(false);

  /* reset local state when the approval entity changes */
  useEffect(() => {
    setNotes('');
    setDetailsOpen(false);
    setAuthorizing(false);
    setDenying(false);
  }, [approval?.id]);

  const handleAuthorize = async () => {
    if (!approval) return;
    setAuthorizing(true);
    try {
      onApprove(approval.id, notes || undefined);
      toast.success('Phase transition authorized');
    } catch {
      toast.error('Authorization failed');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleDeny = async () => {
    if (!approval) return;
    setDenying(true);
    try {
      onReject(approval.id, notes || undefined);
      toast.error('Phase transition denied');
    } catch {
      toast.error('Rejection failed');
    } finally {
      setDenying(false);
    }
  };

  return (
    <Dialog.Root open={approval !== null}>
      <Dialog.Portal>
        {/* ── overlay ── */}
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />

        {/* ── content ── */}
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-mc-surface border border-mc-amber max-w-md w-full p-6 font-mono focus:outline-none"
        >
          {/* title */}
          <Dialog.Title asChild>
            <DataLabel className="text-mc-amber text-xs tracking-wider">
              PHASE TRANSITION AUTHORIZATION
            </DataLabel>
          </Dialog.Title>

          <Dialog.Description className="sr-only">
            Approve or deny the requested phase transition.
          </Dialog.Description>

          {/* phase badge */}
          <div className="mt-4">
            <StatusBadge status={approval?.phase ?? 'recon'} variant="phase" />
          </div>

          {/* description */}
          <p className="mt-3 text-mc-text-dim text-sm font-mono leading-relaxed">
            {approval?.description ?? 'No description provided.'}
          </p>

          {/* payload viewer */}
          {approval?.payload && (
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="text-[10px] font-mono text-mc-text-ghost hover:text-mc-text-dim transition-colors uppercase tracking-wider"
              >
                {detailsOpen ? 'hide details' : 'show details'}
              </button>
              {detailsOpen && (
                <pre className="bg-mc-bg border border-mc-border p-3 text-[10px] font-mono text-mc-text-dim overflow-auto max-h-32">
                  <code>{JSON.stringify(approval.payload, null, 2)}</code>
                </pre>
              )}
            </div>
          )}

          {/* operator notes */}
          <div className="mt-4 space-y-1">
            <label
              htmlFor="approval-notes"
              className="block text-[10px] font-mono text-mc-text-ghost uppercase tracking-wider"
            >
              operator notes
            </label>
            <textarea
              id="approval-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional notes..."
              className="w-full bg-mc-bg border border-mc-border p-2 text-xs font-mono text-mc-text placeholder:text-mc-text-ghost focus:outline-none focus:border-mc-border-bright resize-none"
            />
          </div>

          {/* action buttons */}
          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={handleAuthorize}
              disabled={authorizing || denying}
              className="flex-1"
            >
              {authorizing ? 'AUTHORIZING...' : 'AUTHORIZE'}
            </Button>
            <Button
              onClick={handleDeny}
              disabled={authorizing || denying}
              variant="danger"
              className="flex-1"
            >
              {denying ? 'DENYING...' : 'DENY'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
