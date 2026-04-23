'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  Wrench,
  CheckCircle2,
  XCircle,
  GitBranch,
  MessageCircle,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'

import { cn, timeAgo, truncate } from '@/lib/utils'
import type { WSMessage } from '@/types'

/**
 * ReAct Timeline — renders the stream of agent_thought / tool_call /
 * tool_result / phase_change / approval_request / final_answer / error
 * messages as a vertical rail with iconography and tight typography.
 *
 * When `active` is true and the last message is not a terminal event
 * (final_answer / error), the last item's ring pulses subtly — the
 * operator's "the agent is thinking right now" cue.
 */
export function ReactTimeline({
  messages,
  active = false,
}: {
  messages: WSMessage[]
  active?: boolean
}) {
  // Only pulse the tail when the flow is active AND the last event isn't a
  // terminal one. Terminal events already have their own semantic colour
  // (critical for error, accent for final_answer), adding pulse on top
  // would mis-train operators into thinking the flow is still running.
  const last = messages[messages.length - 1]
  const lastIsTerminal =
    last?.type === 'final_answer' || last?.type === 'error'
  const pulseLastIndex =
    active && !lastIsTerminal && messages.length > 0
      ? messages.length - 1
      : -1

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
        <Sparkles className="h-4 w-4 text-fg-subtle" />
        <div className="text-sm font-medium text-fg">Waiting for agent activity</div>
        <div className="text-xs text-fg-muted max-w-sm">
          When the flow runs, you&apos;ll see reasoning steps, tool calls, and
          observations stream in here in real-time.
        </div>
      </div>
    )
  }

  return (
    <ol className="relative flex flex-col">
      <div aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      {messages.map((m, i) => (
        <TimelineItem
          key={`${m.type}-${m.timestamp}-${i}`}
          msg={m}
          index={i}
          live={i === pulseLastIndex}
        />
      ))}
    </ol>
  )
}

function TimelineItem({
  msg,
  index,
  live,
}: {
  msg: WSMessage
  index: number
  live: boolean
}) {
  const meta = describe(msg)
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex gap-3 py-2.5 pr-2 pl-1"
    >
      <span
        className={cn(
          'relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0',
          'border bg-bg ring-inset-hi',
          meta.ring,
          // Pulse ring on the active (last, non-terminal) step when the
          // flow is running. Uses the accent or critical pulse depending
          // on whether the step itself is critical-toned.
          live && (meta.critical ? 'pulse-critical' : 'pulse-accent'),
        )}
      >
        <meta.icon className={cn('h-3.5 w-3.5', meta.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
            {meta.label}
          </span>
          {msg.iteration !== undefined && (
            <span className="text-2xs text-fg-subtle font-mono">· iter {msg.iteration}</span>
          )}
          <span className="text-2xs text-fg-subtle font-mono ml-auto">{timeAgo(msg.timestamp)}</span>
        </div>
        {meta.body && (
          <div className="mt-0.5 text-xs leading-relaxed text-fg break-words">{meta.body}</div>
        )}
        {meta.detail && (
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-border bg-bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed font-mono text-fg-muted">
            {meta.detail}
          </pre>
        )}
      </div>
    </motion.li>
  )
}

type Describe = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  ring: string
  body?: React.ReactNode
  detail?: string
  /** When true and this is the live/active step, pulse uses the critical
   *  palette instead of accent — matches the step's semantic colour. */
  critical?: boolean
}

function describe(m: WSMessage): Describe {
  switch (m.type) {
    case 'agent_thought':
      return {
        label: 'Thought',
        icon: Brain,
        iconClass: 'text-accent',
        ring: 'border-accent/40',
        body: truncate(m.content ?? stringifyPayload(m.payload), 400),
      }
    case 'tool_call': {
      const input = m.toolInput ?? (typeof m.payload === 'object' && m.payload && 'input' in m.payload ? (m.payload as { input: unknown }).input : undefined)
      return {
        label: 'Tool call',
        icon: Wrench,
        iconClass: 'text-sev-medium',
        ring: 'border-sev-medium/40',
        body: (
          <span>
            <span className="font-mono text-fg">{m.toolName ?? 'tool'}</span>
            {input !== undefined && <span className="text-fg-subtle"> · invoked</span>}
          </span>
        ),
        detail: input !== undefined ? safeJson(input) : undefined,
      }
    }
    case 'tool_result':
      return {
        label: m.success === false ? 'Tool failed' : 'Observation',
        icon: m.success === false ? XCircle : CheckCircle2,
        iconClass: m.success === false ? 'text-sev-critical' : 'text-accent',
        ring: m.success === false ? 'border-sev-critical/40' : 'border-accent/40',
        body: truncate(m.content ?? stringifyPayload(m.payload), 400),
        critical: m.success === false,
      }
    case 'phase_change':
      return {
        label: 'Phase change',
        icon: GitBranch,
        iconClass: 'text-accent',
        ring: 'border-accent/40',
        body: m.content ?? stringifyPayload(m.payload),
      }
    case 'approval_request':
      return {
        label: 'Approval required',
        icon: AlertTriangle,
        iconClass: 'text-sev-high',
        ring: 'border-sev-high/40',
        body: m.content ?? 'Phase gate requires your approval before proceeding.',
      }
    case 'user_guidance':
      return {
        label: 'Operator',
        icon: MessageCircle,
        iconClass: 'text-fg',
        ring: 'border-border-strong',
        body: m.content ?? stringifyPayload(m.payload),
      }
    case 'final_answer':
      return {
        label: 'Final answer',
        icon: Sparkles,
        iconClass: 'text-accent',
        ring: 'border-accent/60',
        body: truncate(m.content ?? stringifyPayload(m.payload), 800),
      }
    case 'error':
      return {
        label: 'Error',
        icon: XCircle,
        iconClass: 'text-sev-critical',
        ring: 'border-sev-critical/40',
        body: m.content ?? stringifyPayload(m.payload),
        critical: true,
      }
    default:
      return {
        label: m.type,
        icon: MessageCircle,
        iconClass: 'text-fg-subtle',
        ring: 'border-border',
        body: stringifyPayload(m.payload),
      }
  }
}

function stringifyPayload(p: unknown): string {
  if (p == null) return ''
  if (typeof p === 'string') return p
  try {
    return JSON.stringify(p)
  } catch {
    return String(p)
  }
}

function safeJson(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
