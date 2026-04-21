'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Check, X, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { flows } from '@/lib/api'
import { PHASE_LABEL } from '@/lib/constants'
import { cn, timeAgo } from '@/lib/utils'
import type { ApprovalRequest } from '@/types'

export function ApprovalsPanel({
  flowId,
  approvals,
  onAction,
}: {
  flowId: string
  approvals: ApprovalRequest[]
  onAction: () => void
}) {
  const pending = approvals.filter((a) => a.status === 'pending')
  const resolved = approvals.filter((a) => a.status !== 'pending')

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
        <ShieldCheck className="h-5 w-5 text-fg-subtle" />
        <div>
          <div className="text-sm font-medium text-fg">No approvals required</div>
          <div className="mt-1 text-xs text-fg-muted max-w-sm">
            Phase gates will appear here when the agent needs your go-ahead before
            transitioning to an exploitation phase.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <section>
          <SectionHeader label={`${pending.length} pending`} danger />
          <ul className="flex flex-col gap-3">
            {pending.map((a) => (
              <ApprovalCard key={a.id} approval={a} flowId={flowId} onAction={onAction} />
            ))}
          </ul>
        </section>
      )}
      {resolved.length > 0 && (
        <section>
          <SectionHeader label={`${resolved.length} resolved`} />
          <ul className="flex flex-col gap-3">
            {resolved.map((a) => (
              <ApprovalCard key={a.id} approval={a} flowId={flowId} onAction={onAction} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SectionHeader({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className={cn(
          'text-2xs uppercase tracking-widest font-mono',
          danger ? 'text-sev-high' : 'text-fg-subtle',
        )}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  )
}

function ApprovalCard({
  approval,
  flowId,
  onAction,
}: {
  approval: ApprovalRequest
  flowId: string
  onAction: () => void
}) {
  const [notes, setNotes] = React.useState('')
  const [busy, setBusy] = React.useState<null | 'approve' | 'reject'>(null)
  const [expanded, setExpanded] = React.useState(false)

  const resolved = approval.status !== 'pending'

  async function run(kind: 'approve' | 'reject') {
    if (busy) return
    setBusy(kind)
    try {
      if (kind === 'approve') {
        await flows.approve(flowId, approval.id, notes.trim() || undefined)
        toast.success('Approved', { description: PHASE_LABEL[approval.phase] })
      } else {
        await flows.reject(flowId, approval.id, notes.trim() || undefined)
        toast.success('Rejected', { description: PHASE_LABEL[approval.phase] })
      }
      onAction()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not submit decision', {
        description: e.response?.data?.error ?? 'Try again.',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card
        className={cn(
          approval.status === 'pending' && 'border-sev-high/30 bg-sev-high/[0.03]',
          approval.status === 'approved' && 'border-accent/30 bg-accent/[0.03]',
          approval.status === 'rejected' && 'border-sev-critical/30 bg-sev-critical/[0.03]',
        )}
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                'h-4 w-4 mt-0.5 shrink-0',
                approval.status === 'pending' && 'text-sev-high',
                approval.status === 'approved' && 'text-accent',
                approval.status === 'rejected' && 'text-sev-critical',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-fg">
                  {PHASE_LABEL[approval.phase]}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'uppercase',
                    approval.status === 'pending' && 'text-sev-high border-sev-high/40',
                    approval.status === 'approved' && 'text-accent border-accent/40',
                    approval.status === 'rejected' && 'text-sev-critical border-sev-critical/40',
                  )}
                >
                  {approval.status}
                </Badge>
                <span className="text-2xs text-fg-subtle font-mono ml-auto">
                  {timeAgo(approval.created_at)}
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-fg-muted">
                {approval.description || 'No description provided.'}
              </div>

              {Object.keys(approval.payload ?? {}).length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-2xs font-mono uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-120"
                  >
                    {expanded ? '− Hide payload' : '+ Show payload'}
                  </button>
                  {expanded && (
                    <pre className="mt-1.5 overflow-x-auto rounded-md border border-border bg-bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed font-mono text-fg-muted">
                      {JSON.stringify(approval.payload, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {!resolved && (
                <>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional) — stored with the decision for audit"
                    rows={2}
                    disabled={busy !== null}
                    className="mt-3 text-xs"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => run('reject')}
                      loading={busy === 'reject'}
                      disabled={busy !== null}
                      leftIcon={<X />}
                      className="text-sev-critical hover:text-sev-critical hover:bg-sev-critical/10"
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => run('approve')}
                      loading={busy === 'approve'}
                      disabled={busy !== null}
                      leftIcon={<Check />}
                    >
                      Approve &amp; continue
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.li>
  )
}
