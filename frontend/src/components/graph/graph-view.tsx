'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Filter, Maximize2, Minimize2, RotateCw, Network as NetworkIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { GraphNode, GraphEdge } from '@/types'

// `react-force-graph-2d` hits `window` at import time — must be client-only.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-subtle/40" />,
}) as React.ComponentType<Record<string, unknown>>

/* ── Node taxonomy ────────────────────────────────────────────────────────── */

const TYPE_META: Record<string, { label: string; color: string; size: number }> = {
  AttackChain:    { label: 'Chain',     color: '#00DC82', size: 7 },
  ChainStep:      { label: 'Step',      color: '#4DA3FF', size: 5 },
  ChainFinding:   { label: 'Finding',   color: '#FFB84D', size: 5 },
  Vulnerability:  { label: 'Vuln',      color: '#FF4D4D', size: 6 },
  Credential:     { label: 'Cred',      color: '#FF8A4D', size: 6 },
  Host:           { label: 'Host',      color: '#A1A1AA', size: 5 },
  Domain:         { label: 'Domain',    color: '#EDEDED', size: 5 },
  Service:        { label: 'Service',   color: '#71717A', size: 4 },
  Target:         { label: 'Target',    color: '#00DC82', size: 6 },
  Asset:          { label: 'Asset',     color: '#A1A1AA', size: 5 },
  default:        { label: 'Node',      color: '#71717A', size: 4 },
}

function typeMeta(t: string) {
  return TYPE_META[t] ?? TYPE_META.default
}

/* ── Internal graph types matching react-force-graph ──────────────────────── */

type ForceNode = GraphNode & {
  __type: string
  __color: string
  __size: number
  __vx?: number
  __vy?: number
}

type ForceLink = {
  source: string | ForceNode
  target: string | ForceNode
  id: string
  type: string
}

/* ── Main view ────────────────────────────────────────────────────────────── */

export function GraphView({
  nodes,
  edges,
  height = 520,
  emptyLabel = 'No graph data yet',
  onNodeOpen,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  height?: number
  emptyLabel?: string
  /** When supplied, the node-detail panel shows an "Open" CTA. */
  onNodeOpen?: (node: GraphNode) => void
}) {
  const [selected, setSelected] = React.useState<GraphNode | null>(null)
  const [hidden, setHidden] = React.useState<Set<string>>(new Set())
  const [expanded, setExpanded] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  // The force-graph ref surface is loose; we only use fit/refresh on it.
  const graphRef = React.useRef<{ zoomToFit?: (ms: number, pad: number) => void; d3ReheatSimulation?: () => void } | null>(null)
  const [dims, setDims] = React.useState<{ w: number; h: number }>({ w: 0, h: height })

  // ResizeObserver so the canvas always fits its container (responsive).
  React.useEffect(() => {
    if (!wrapperRef.current) return
    const el = wrapperRef.current
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setDims({ w: Math.max(0, rect.width), h: Math.max(240, rect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Derive the filtered + annotated graph data.
  const graphData = React.useMemo(() => {
    const allowed = (t: string) => !hidden.has(t)
    const visibleIds = new Set(nodes.filter((n) => allowed(n.type)).map((n) => n.id))
    const fNodes: ForceNode[] = nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => {
        const meta = typeMeta(n.type)
        return { ...n, __type: n.type, __color: meta.color, __size: meta.size }
      })
    const fLinks: ForceLink[] = edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
    return { nodes: fNodes, links: fLinks }
  }, [nodes, edges, hidden])

  const typeCounts = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const n of nodes) m.set(n.type, (m.get(n.type) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [nodes])

  const toggleType = (t: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const zoomFit = React.useCallback(() => {
    graphRef.current?.zoomToFit?.(400, 60)
  }, [])

  const reheat = React.useCallback(() => {
    graphRef.current?.d3ReheatSimulation?.()
  }, [])

  // Auto-fit whenever the data or the container size shifts meaningfully.
  React.useEffect(() => {
    const t = setTimeout(() => zoomFit(), 120)
    return () => clearTimeout(t)
  }, [graphData, dims.w, zoomFit])

  if (!nodes.length) {
    return <EmptyGraph label={emptyLabel} height={height} />
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative rounded-md border border-border-subtle bg-bg-subtle/40 overflow-hidden',
        expanded && 'fixed inset-3 sm:inset-6 z-50 rounded-lg border-border-strong bg-bg shadow-pop',
      )}
      style={expanded ? undefined : { height }}
    >
      {/* Dot grid backdrop — faint, accents the mono aesthetic */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30" />

      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-mono text-2xs uppercase tracking-widest">
          {graphData.nodes.length}/{nodes.length} nodes
        </Badge>
        <Badge variant="outline" className="font-mono text-2xs uppercase tracking-widest">
          {graphData.links.length} edges
        </Badge>
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <Button variant="secondary" size="icon-sm" onClick={reheat} aria-label="Re-layout graph">
          <RotateCw />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={zoomFit} aria-label="Fit graph to view">
          <Maximize2 />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse graph' : 'Expand graph'}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>

      {/* Type filter legend */}
      <div className="absolute left-3 bottom-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-md border border-border-subtle bg-bg/80 backdrop-blur px-2 py-1.5">
        <Filter className="h-3 w-3 text-fg-subtle shrink-0" aria-hidden />
        {typeCounts.map(([t, n]) => {
          const meta = typeMeta(t)
          const off = hidden.has(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-mono uppercase tracking-widest border transition-colors duration-120',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                off
                  ? 'border-border-subtle text-fg-disabled line-through opacity-60'
                  : 'border-border text-fg hover:border-border-strong',
              )}
              aria-pressed={!off}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color, boxShadow: off ? 'none' : `0 0 6px ${meta.color}` }}
              />
              {meta.label}
              <span className="text-fg-subtle">· {n}</span>
            </button>
          )
        })}
      </div>

      {/* Canvas */}
      {dims.w > 0 && (
        <ForceGraph2D
          ref={graphRef as unknown as React.Ref<unknown>}
          graphData={graphData}
          width={dims.w}
          height={expanded ? dims.h : height}
          backgroundColor="rgba(0,0,0,0)"
          linkColor={() => 'rgba(255,255,255,0.12)'}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.2}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={() => 'rgba(0,220,130,0.55)'}
          nodeRelSize={4}
          nodeVal={(n: ForceNode) => n.__size}
          nodeColor={(n: ForceNode) => n.__color}
          nodeLabel={(n: ForceNode) => `${n.label} · ${n.__type}`}
          cooldownTicks={120}
          onNodeClick={(n: ForceNode) => setSelected(n as GraphNode)}
          onBackgroundClick={() => setSelected(null)}
          nodeCanvasObject={(node: ForceNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.label ?? ''
            const r = node.__size
            const x = node.x ?? 0
            const y = node.y ?? 0
            // Glow
            ctx.beginPath()
            ctx.arc(x, y, r + 3, 0, 2 * Math.PI)
            ctx.fillStyle = `${node.__color}22`
            ctx.fill()
            // Core
            ctx.beginPath()
            ctx.arc(x, y, r, 0, 2 * Math.PI)
            ctx.fillStyle = node.__color
            ctx.fill()
            // Ring when selected
            if (selected && selected.id === node.id) {
              ctx.lineWidth = 1.5 / globalScale
              ctx.strokeStyle = '#EDEDED'
              ctx.stroke()
            }
            // Label when zoomed in
            if (globalScale > 1.2 && label) {
              ctx.font = `${10 / globalScale}px var(--font-mono, monospace)`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = 'rgba(237,237,237,0.85)'
              ctx.fillText(label.length > 28 ? label.slice(0, 28) + '…' : label, x, y + r + 6 / globalScale)
            }
          }}
        />
      )}

      {/* Selected-node panel */}
      {selected && (
        <div className="absolute right-3 bottom-3 z-10 w-[min(340px,calc(100%-1.5rem))]">
          <NodeDetail
            node={selected}
            onClose={() => setSelected(null)}
            onOpen={onNodeOpen ? () => onNodeOpen(selected) : undefined}
          />
        </div>
      )}
    </div>
  )
}

/* ── Node detail card ─────────────────────────────────────────────────────── */

function NodeDetail({
  node,
  onClose,
  onOpen,
}: {
  node: GraphNode
  onClose: () => void
  onOpen?: () => void
}) {
  const meta = typeMeta(node.type)
  const entries = Object.entries(node.properties ?? {}).slice(0, 6)

  return (
    <Card className="border-border-strong shadow-pop">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 meta-mono">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
              />
              {meta.label}
            </div>
            <div className="mt-1 text-xs font-medium text-fg truncate">{node.label}</div>
            <div className="mt-0.5 text-2xs text-fg-subtle font-mono truncate">{node.id}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-subtle hover:text-fg text-xs"
            aria-label="Close node detail"
          >
            ×
          </button>
        </div>

        {entries.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-2xs">
            {entries.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="font-mono uppercase tracking-widest text-fg-subtle">{k}</dt>
                <dd className="font-mono text-fg truncate" title={String(v)}>
                  {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                    ? String(v)
                    : JSON.stringify(v)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        )}

        {onOpen && (
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" size="xs" onClick={onOpen}>Open</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

function EmptyGraph({ label, height }: { label: string; height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-border-subtle bg-bg-subtle/30 bg-dot-grid"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-center px-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-subtle">
          <NetworkIcon className="h-4 w-4 text-fg-subtle" />
        </div>
        <div className="text-sm font-medium text-fg">{label}</div>
        <div className="text-xs text-fg-muted max-w-sm">
          As the agent discovers hosts, services, and findings, the EvoGraph fills out here
          in real time.
        </div>
      </div>
    </div>
  )
}
