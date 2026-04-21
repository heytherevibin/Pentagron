'use client'

import * as React from 'react'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { StatusDot } from '@/components/ui/status-dot'
import { cn } from '@/lib/utils'

/**
 * AgentChat — single-input composer for sending guidance back to the agent
 * over the WebSocket. Enter sends, Shift+Enter inserts a newline.
 */
export function AgentChat({
  connected,
  onSend,
  disabled,
}: {
  connected: boolean
  onSend: (text: string) => void
  disabled?: boolean
}) {
  const [text, setText] = React.useState('')
  const ref = React.useRef<HTMLTextAreaElement>(null)

  function submit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    ref.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <StatusDot tone={connected ? 'accent' : 'danger'} pulse={connected} size={6} />
        <span className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
          {connected ? 'Live · stream connected' : 'Disconnected · reconnecting…'}
        </span>
      </div>
      <div className="relative">
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={connected ? 'Nudge the agent — try "focus on the SMB service next"' : 'Waiting for connection…'}
          rows={3}
          disabled={disabled || !connected}
          className={cn('pr-20 resize-none')}
        />
        <div className="absolute bottom-2 right-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={!connected || !text.trim() || disabled}
            rightIcon={<Send />}
          >
            Send
          </Button>
        </div>
      </div>
      <div className="text-2xs text-fg-subtle font-mono">
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  )
}
