'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useAgentWebSocket } from '@/hooks/useAgentWebSocket';
import { GlowDot } from '@/components/ui/GlowDot';
import { DataLabel } from '@/components/ui/DataLabel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import type { WSMessage, WSMessageType } from '@/types';

/* ─── props ─── */
interface AgentChatProps {
  flowId: string;
}

/* ─── per-message renderer ─── */
function MessageItem({ msg }: { msg: WSMessage }) {
  const [expanded, setExpanded] = useState(false);

  /* ping — skip entirely */
  if (msg.type === ('ping' as WSMessageType)) return null;

  /* agent_thought */
  if (msg.type === ('agent_thought' as WSMessageType)) {
    return (
      <div className="border-l-2 border-mc-border-bright pl-3 py-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-mc-text-ghost text-xs font-mono tracking-wide hover:text-mc-text-dim transition-colors w-full text-left"
        >
          <span className="uppercase">
            thought{msg.iteration !== undefined ? ` [iter ${msg.iteration}]` : ''}
          </span>
          <span className="ml-auto text-[10px]">{expanded ? '▼' : '▶'}</span>
        </button>
        {expanded && (
          <p className="mt-1 text-xs text-mc-text-dim font-mono whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </p>
        )}
      </div>
    );
  }

  /* tool_call */
  if (msg.type === ('tool_call' as WSMessageType)) {
    return (
      <div className="bg-blue-950/20 border-l-2 border-mc-blue pl-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <DataLabel className="text-mc-blue">TOOL CALL</DataLabel>
          <span className="text-xs font-mono font-bold text-mc-text">
            {msg.toolName ?? 'unknown'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-mono text-mc-text-ghost hover:text-mc-text-dim transition-colors"
        >
          {expanded ? 'hide input' : 'show input'}
        </button>
        {expanded && msg.toolInput != null && (
          <pre className="bg-mc-bg border border-mc-border p-2 text-[10px] font-mono text-mc-text-dim overflow-auto max-h-40 rounded-none">
            <code>{JSON.stringify(msg.toolInput, null, 2)}</code>
          </pre>
        )}
      </div>
    );
  }

  /* tool_result */
  if (msg.type === ('tool_result' as WSMessageType)) {
    const ok = msg.success !== false;
    const output = msg.content ?? '';
    const truncated = output.length > 500 && !expanded;
    return (
      <div
        className={cn(
          'pl-3 py-2 space-y-1',
          ok
            ? 'border-l-2 border-mc-emerald bg-emerald-950/10'
            : 'border-l-2 border-mc-crimson bg-red-950/10',
        )}
      >
        <DataLabel className={ok ? 'text-mc-emerald' : 'text-mc-crimson'}>
          {ok ? 'EXEC OK' : 'EXEC FAIL'}
        </DataLabel>
        <pre className="text-[10px] font-mono text-mc-text-dim whitespace-pre-wrap break-all">
          <code>{truncated ? output.slice(0, 500) : output}</code>
        </pre>
        {output.length > 500 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-mono text-mc-text-ghost hover:text-mc-text-dim transition-colors"
          >
            {expanded ? 'collapse' : `expand (${output.length} chars)`}
          </button>
        )}
      </div>
    );
  }

  /* phase_change */
  if (msg.type === ('phase_change' as WSMessageType)) {
    return (
      <div className="flex items-center gap-3 py-3">
        <span className="flex-1 h-px bg-mc-border-bright" />
        <span className="text-mc-emerald text-[10px] font-mono uppercase tracking-wider font-bold">
          phase: {msg.content}
        </span>
        <span className="flex-1 h-px bg-mc-border-bright" />
      </div>
    );
  }

  /* final_answer */
  if (msg.type === ('final_answer' as WSMessageType)) {
    return (
      <div className="border border-mc-emerald bg-emerald-950/10 p-4 space-y-2">
        <DataLabel className="text-mc-emerald">REPORT</DataLabel>
        <p className="text-xs font-mono text-mc-text whitespace-pre-wrap leading-relaxed">
          {msg.content}
        </p>
      </div>
    );
  }

  /* error */
  if (msg.type === ('error' as WSMessageType)) {
    return (
      <div className="border-l-2 border-mc-crimson bg-red-950/10 pl-3 py-2 space-y-1">
        <DataLabel className="text-mc-crimson">SYSTEM ERROR</DataLabel>
        <p className="text-xs font-mono text-mc-crimson whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
    );
  }

  /* fallback */
  return (
    <div className="pl-3 py-1 text-xs font-mono text-mc-text-dim">
      {msg.content}
    </div>
  );
}

/* ─── main component ─── */
export default function AgentChat({ flowId }: AgentChatProps) {
  const { messages, connected, sendGuidance, clearMessages } =
    useAgentWebSocket({ sessionId: `log-${flowId}`, flowId });

  const streamRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [guidance, setGuidance] = useState('');

  /* auto-scroll on new messages */
  useEffect(() => {
    if (autoScroll && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  /* detect user scroll-away */
  const handleScroll = useCallback(() => {
    if (!streamRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = streamRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 48;
    setAutoScroll(atBottom);
  }, []);

  /* submit guidance */
  const handleSend = () => {
    const text = guidance.trim();
    if (!text) return;
    sendGuidance(text);
    setGuidance('');
  };

  return (
    <div className="flex flex-col h-full bg-mc-surface border border-mc-border font-mono">
      {/* ── header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mc-border shrink-0">
        <GlowDot status={connected ? 'ok' : 'error'} />
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider font-bold',
            connected ? 'text-mc-emerald' : 'text-mc-crimson',
          )}
        >
          {connected ? 'connected' : 'disconnected'}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={clearMessages}
          className="text-[10px] text-mc-text-ghost hover:text-mc-text-dim transition-colors uppercase tracking-wider"
        >
          clear
        </button>
      </div>

      {/* ── message stream ── */}
      <div
        ref={streamRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 relative"
      >
        {messages.map((msg, i) => (
          <MessageItem key={`${msg.type}-${i}`} msg={msg} />
        ))}

        {/* scroll-to-bottom FAB */}
        {!autoScroll && (
          <button
            type="button"
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.scrollTop = streamRef.current.scrollHeight;
              }
              setAutoScroll(true);
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-mc-surface border border-mc-border-bright px-3 py-1 text-[10px] font-mono text-mc-text-dim hover:text-mc-text uppercase tracking-wider transition-colors z-10"
          >
            scroll to bottom
          </button>
        )}
      </div>

      {/* ── guidance input ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-mc-border shrink-0">
        <Input
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="operator guidance..."
          className="flex-1 text-xs"
        />
        <Button onClick={handleSend} size="sm">
          SEND
        </Button>
      </div>
    </div>
  );
}
