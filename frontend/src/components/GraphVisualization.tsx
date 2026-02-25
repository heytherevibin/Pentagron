'use client';

import { useRef, useEffect, useCallback } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { GraphNode, GraphEdge } from '@/types';

/* ─── props ─── */
interface GraphVisualizationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}

/* ─── node color map ─── */
const NODE_COLORS: Record<string, string> = {
  AttackChain:    '#10b981',
  ChainStep:      '#64748b',
  ChainFinding:   '#dc2626',
  Domain:         '#3b82f6',
  Host:           '#7c3aed',
  Service:        '#0ea5e9',
  Vulnerability:  '#dc2626',
};
const DEFAULT_COLOR = '#475569';

function getNodeColor(type: string): string {
  return NODE_COLORS[type] ?? DEFAULT_COLOR;
}

/* ─── build SVG <defs> for glow filters ─── */
function buildGlowDefs(): string {
  const uniqueColors = Array.from(
    new Set([...Object.values(NODE_COLORS), DEFAULT_COLOR]),
  );
  const filters = uniqueColors
    .map(
      (color, i) => `
      <filter id="glow-${i}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
        <feFlood flood-color="${color}" flood-opacity="0.6" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="glowed"/>
        <feMerge>
          <feMergeNode in="glowed"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>`,
    )
    .join('');
  return `<defs>${filters}</defs>`;
}

/* resolve glow filter id for a given color */
function glowFilterUrl(color: string): string {
  const uniqueColors = Array.from(
    new Set([...Object.values(NODE_COLORS), DEFAULT_COLOR]),
  );
  const idx = uniqueColors.indexOf(color);
  return idx >= 0 ? `url(#glow-${idx})` : '';
}

/* ─── component ─── */
export default function GraphVisualization({
  nodes,
  edges,
  width = 600,
  height = 400,
  onNodeClick,
}: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null);

  const render = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!containerRef.current) return;
    if (nodes.length === 0) return;

    /* dynamic import — avoids SSR crash */
    const d3 = await import('d3');

    /* wipe previous render */
    d3.select(containerRef.current).selectAll('*').remove();

    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', 'transparent')
      .style('font-family', "'JetBrains Mono', monospace");

    /* glow filter definitions */
    svg.html(buildGlowDefs() + svg.html());

    const g = svg.append('g');

    /* zoom + pan */
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    /* deep-copy data so d3 can mutate positions */
    const simNodes = nodes.map((n) => ({ ...n })) as any[];
    const simEdges = edges.map((e) => ({
      ...e,
      source: e.source,
      target: e.target,
    })) as any[];

    /* force simulation */
    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(simEdges)
          .id((d: any) => d.id)
          .distance(60),
      )
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));

    simulationRef.current = simulation;

    /* ── edges ── */
    const link = g
      .append('g')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.6);

    /* ── nodes ── */
    const node = g
      .append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', 8)
      .attr('fill', (d: any) => getNodeColor(d.type))
      .attr('stroke', '#0a0e1a')
      .attr('stroke-width', 2)
      .attr('filter', (d: any) => glowFilterUrl(getNodeColor(d.type)))
      .style('cursor', onNodeClick ? 'pointer' : 'default');

    if (onNodeClick) {
      node.on('click', (_event: any, d: any) => {
        const original = nodes.find((n) => n.id === d.id);
        if (original) onNodeClick(original);
      });
    }

    /* ── drag ── */
    const drag = d3
      .drag<SVGCircleElement, any>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(drag as any);

    /* ── labels ── */
    const label = g
      .append('g')
      .selectAll('text')
      .data(simNodes)
      .join('text')
      .text((d: any) => d.label ?? d.id)
      .attr('fill', '#94a3b8')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('font-size', '9px')
      .attr('text-anchor', 'middle')
      .attr('dy', 20)
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    /* ── tick ── */
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });
  }, [nodes, edges, width, height, onNodeClick]);

  /* mount / update / cleanup */
  useEffect(() => {
    render();
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [render]);

  /* empty state */
  if (nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-mc-border bg-mc-surface"
        style={{ width, height }}
      >
        <EmptyState title="GRAPH DATA UNAVAILABLE" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="border border-mc-border bg-mc-surface overflow-hidden"
      style={{ width, height }}
    />
  );
}
