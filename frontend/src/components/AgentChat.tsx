'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useAgentWebSocket } from '@/hooks/useAgentWebSocket'
import { GlowDot } from '@/components/ui/GlowDot'
import { DataLabel } from '@/components/ui/DataLabel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import type { WSMessage, WSMessageType } from '@/types'

interface AgentChatProps {
  flowId: string
}

function MessageItem({ msg }: { msg: WSMessage }) {
  const [expanded, setExpanded] = useState(false)

  if (msg.type === ('ping' as WSMessageType)) return null

  if (msg.type === ('agent_thought' as WSMessageType)) {
    return (
      <div className="border-l-2 border-surface-3 pl-3 py-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-muted text-xs font-mono tracking-wide hover:text-foreground transition-colors w-full text-left"
        >
          <span className="uppercase">
            thought{msg.iteration !== undefined ? ` [iter ${msg.iteration}]` : ''}
          </span>
          <span className="ml-auto text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
        </button>
        {expanded && (
          <p className="mt-1 text-xs text-muted font-mono whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </p>
        )}
      </div>
    )
  }

  if (msg.type === ('tool_call' as WSMessageType)) {
    return (
      <div className="bg-blue-500/5 border-l-2 border-blue-500 pl-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <DataLabel className="text-blue-400">TOOL CALL</DataLabel>
          <span className="text-xs font-mono font-bold text-foreground">
            {msg.toolName ?? 'unknown'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-mono text-muted hover:text-foreground transition-colors"
        >
          {expanded ? 'hide input' : 'show input'}
        </button>
        {expanded && msg.toolInput != null && (
          <pre className="bg-background border border-border p-2 text-[10px] font-mono text-muted overflow-auto max-h-40">
            <code>{JSON.stringify(msg.toolInput, null, 2)}</code>
          </pre>
        )}
      </div>
    )
  }

  if (msg.type === ('tool_result' as WSMessageType)) {
    const ok = msg.success !== false
    const output = msg.content ?? ''
    const truncated = output.length > 500 && !expanded
    return (
      <div
        className={cn(
          'pl-3 py-2 space-y-1',
          ok
            ? 'border-l-2 border-emerald-500 bg-emerald-500/5'
            : 'border-l-2 border-red-500 bg-red-500/5',
        )}
      >
        <DataLabel className={ok ? 'text-emerald-400' : 'text-red-400'}>
          {ok ? 'EXEC OK' : 'EXEC FAIL'}
        </DataLabel>
        <pre className="text-[10px] font-mono text-muted whitespace-pre-wrap break-all">
          <code>{truncated ? output.slice(0, 500) : output}</code>
        </pre>
        {output.length > 500 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-mono text-muted hover:text-foreground transition-colors"
          >
            {expanded ? 'collapse' : `expand (${output.length} chars)`}
          </button>
        )}
      </div>
    )
  }

  if (msg.type === ('phase_change' as WSMessageType)) {
    return (
      <div className="flex items-center gap-3 py-3">
        <span className="flex-1 h-px bg-surface-3" />
        <span className="text-emerald-400 text-[10px] font-mono uppercase tracking-wider font-bold">
          phase: {msg.content}
        </span>
        <span className="flex-1 h-px bg-surface-3" />
      </div>
    )
  }

  if (msg.type === ('final_answer' as WSMessageType)) {
    return (
      <div className="border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <DataLabel className="text-emerald-400">REPORT</DataLabel>
        <p className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
          {msg.content}
        </p>
      </div>
    )
  }

  if (msg.type === ('error' as WSMessageType)) {
    return (
      <div className="border-l-2 border-red-500 bg-red-500/5 pl-3 py-2 space-y-1">
        <DataLabel className="text-red-400">SYSTEM ERROR</DataLabel>
        <p className="text-xs font-mono text-red-400 whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
    )
  }

  return (
    <div className="pl-3 py-1 text-xs font-mono text-muted">
      {msg.content}
    </div>
  )
}

export default function AgentChat({ flowId }: AgentChatProps) {
  const { messages, connected, sendGuidance, clearMessages } =
    useAgentWebSocket({ sessionId: `log-${flowId}`, flowId })

  const streamRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [guidance, setGuidance] = useState('')

  useEffect(() => {
    if (autoScroll && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  const handleScroll = useCallback(() => {
    if (!streamRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = streamRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 48
    setAutoScroll(atBottom)
  }, [])

  const handleSend = () => {
    const text = guidance.trim()
    if (!text) return
    sendGuidance(text)
    setGuidance('')
  }

  return (
    <div className="flex flex-col h-full bg-surface-1 border border-border font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <GlowDot status={connected ? 'ok' : 'error'} />
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider font-bold',
            connected ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {connected ? 'connected' : 'disconnected'}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={clearMessages}
          className="text-[10px] text-muted hover:text-foreground transition-colors uppercase tracking-wider"
        >
          clear
        </button>
      </div>

      {/* Message stream */}
      <div
        ref={streamRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 relative"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-muted text-xs font-mono">
              Start the flow to see agent activity and tool output.
            </p>
            <p className="text-muted/80 text-[10px] font-mono mt-1">
              Messages will appear here when the flow is running.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageItem key={`${msg.type}-${i}`} msg={msg} />
            ))}
          </>
        )}

        {messages.length > 0 && !autoScroll && (
          <button
            type="button"
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.scrollTop = streamRef.current.scrollHeight
              }
              setAutoScroll(true)
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-surface-1 border border-surface-3 px-3 py-1 text-[10px] font-mono text-muted hover:text-foreground uppercase tracking-wider transition-colors z-10"
          >
            scroll to bottom
          </button>
        )}
      </div>

      {/* Guidance input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border shrink-0">
        <Input
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="operator guidance..."
          className="flex-1 text-xs"
        />
        <Button onClick={handleSend} size="sm">
          Send
        </Button>
      </div>
    </div>
  )
}
