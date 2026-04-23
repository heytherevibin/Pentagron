/**
 * chart-theme.ts — single source of truth for Recharts styling so every
 * chart in /insights looks identical. Reads the CSS variables we already
 * publish via globals.css so light/dark switches follow automatically.
 */

export const SEV_COLOR = {
  critical: 'hsl(var(--sev-critical))',
  high:     'hsl(var(--sev-high))',
  medium:   'hsl(var(--sev-medium))',
  low:      'hsl(var(--sev-low))',
  info:     'hsl(var(--sev-info))',
} as const

export const CHART_COLORS = [
  'hsl(var(--accent))',
  'hsl(var(--sev-low))',
  'hsl(var(--sev-medium))',
  'hsl(var(--sev-high))',
  'hsl(var(--sev-critical))',
] as const

export const CHART_GRID = {
  stroke: 'hsl(var(--border-subtle))',
  strokeDasharray: '3 3',
}

export const CHART_AXIS = {
  stroke: 'hsl(var(--fg-disabled))',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  tick: { fill: 'hsl(var(--fg-subtle))' },
}

export const CHART_TOOLTIP_STYLE = {
  background: 'hsl(var(--bg-elevated))',
  border: '1px solid hsl(var(--border-strong))',
  borderRadius: 6,
  fontSize: 12,
  color: 'hsl(var(--fg))',
  boxShadow: '0 4px 20px hsl(0 0% 0% / 0.35)',
} as const
