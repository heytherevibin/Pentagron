'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { wsUrl } from '@/lib/api'
import type { WSMessage, WSMessageType } from '@/types'

interface UseAgentWebSocketOptions {
  sessionId: string
  flowId: string
  onMessage?: (msg: WSMessage) => void
}

interface UseAgentWebSocketReturn {
  messages: WSMessage[]
  connected: boolean
  sendGuidance: (text: string) => void
  clearMessages: () => void
}

export function useAgentWebSocket({
  sessionId,
  flowId,
  onMessage,
}: UseAgentWebSocketOptions): UseAgentWebSocketReturn {
  const [messages, setMessages] = useState<WSMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    const url = wsUrl(`/ws/agent/${sessionId}?flow_id=${flowId}`)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'ping') return
        setMessages((prev) => [...prev, msg])
        onMessage?.(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setConnected(false)
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [sessionId, flowId, onMessage])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendGuidance = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: Partial<WSMessage> = {
        type: 'user_guidance' as WSMessageType,
        session_id: sessionId,
        flow_id: flowId,
        payload: { text },
        timestamp: new Date().toISOString(),
      }
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [sessionId, flowId])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, connected, sendGuidance, clearMessages }
}
