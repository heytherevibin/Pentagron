import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Pentagron design system — Vercel DNA, true-black canvas, electric green accent.
 *
 * Token layers:
 *   - bg.*       canvas + surfaces (literal darkness levels)
 *   - border.*   1px hairlines, dim → bright
 *   - fg.*       text, muted → primary
 *   - accent     #00DC82 — Vercel green, used for CTAs / focus / brand dot
 *   - sev.*      severity scale (critical → info)
 *
 * Radii are tight (4–8px), motion is restrained (sub-200ms, mostly opacity + 6px translate).
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // ── Canvas / surfaces ────────────────────────────────────────────────
        bg: {
          DEFAULT: 'hsl(var(--bg) / <alpha-value>)',         // #000
          subtle:  'hsl(var(--bg-subtle) / <alpha-value>)',  // #0A0A0A
          muted:   'hsl(var(--bg-muted) / <alpha-value>)',   // #111
          elevated:'hsl(var(--bg-elevated) / <alpha-value>)',// #18181B
          inverse: 'hsl(var(--bg-inverse) / <alpha-value>)', // #FAFAFA
        },
        // ── Hairlines ────────────────────────────────────────────────────────
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',         // #1F1F1F
          subtle:  'hsl(var(--border-subtle) / <alpha-value>)',  // #141414
          strong:  'hsl(var(--border-strong) / <alpha-value>)',  // #2A2A2A
        },
        // ── Foreground ───────────────────────────────────────────────────────
        fg: {
          DEFAULT:  'hsl(var(--fg) / <alpha-value>)',          // #EDEDED
          muted:    'hsl(var(--fg-muted) / <alpha-value>)',    // #A1A1AA
          subtle:   'hsl(var(--fg-subtle) / <alpha-value>)',   // #71717A
          disabled: 'hsl(var(--fg-disabled) / <alpha-value>)', // #52525B
          inverse:  'hsl(var(--fg-inverse) / <alpha-value>)',  // #0A0A0A
        },
        // ── Brand accent (Vercel green) ──────────────────────────────────────
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',     // #00DC82
          hover:   'hsl(var(--accent-hover) / <alpha-value>)',
          subtle:  'hsl(var(--accent-subtle) / <alpha-value>)',
          fg:      'hsl(var(--accent-fg) / <alpha-value>)',  // text on accent surface
        },
        // ── Severity scale ───────────────────────────────────────────────────
        sev: {
          critical: 'hsl(var(--sev-critical) / <alpha-value>)', // #FF4D4D
          high:     'hsl(var(--sev-high) / <alpha-value>)',     // #FF8A4D
          medium:   'hsl(var(--sev-medium) / <alpha-value>)',   // #FFB84D
          low:      'hsl(var(--sev-low) / <alpha-value>)',      // #4DA3FF
          info:     'hsl(var(--sev-info) / <alpha-value>)',     // #A1A1AA
        },
        // ── Semantic states ──────────────────────────────────────────────────
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger:  'hsl(var(--danger) / <alpha-value>)',
        info:    'hsl(var(--info) / <alpha-value>)',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        xs:    ['11px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '18px' }],
        base:  ['14px', { lineHeight: '20px' }],
        md:    ['15px', { lineHeight: '22px' }],
        lg:    ['16px', { lineHeight: '24px' }],
        xl:    ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '3xl': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
        '4xl': ['36px', { lineHeight: '42px', letterSpacing: '-0.025em' }],
        '5xl': ['48px', { lineHeight: '54px', letterSpacing: '-0.03em' }],
        '6xl': ['60px', { lineHeight: '66px', letterSpacing: '-0.035em' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter:  '-0.025em',
        tight:    '-0.015em',
        normal:   '0',
        wide:     '0.01em',
        wider:    '0.025em',
        widest:   '0.08em',
      },
      boxShadow: {
        // Vercel-style: subtle, mostly inset/border-driven
        glow:        '0 0 0 1px hsl(var(--border-strong) / 1)',
        'glow-sm':   '0 0 24px -6px hsl(var(--accent) / 0.18)',
        'glow-md':   '0 0 48px -12px hsl(var(--accent) / 0.25)',
        'card':      '0 0 0 1px hsl(var(--border) / 1), 0 1px 2px hsl(0 0% 0% / 0.4)',
        'pop':       '0 8px 24px -6px hsl(0 0% 0% / 0.6), 0 0 0 1px hsl(var(--border-strong) / 1)',
        'inner-hi':  'inset 0 1px 0 0 hsl(0 0% 100% / 0.04)',
        // Canonical elevation tiers — 1:cards, 2:menus, 3:dialogs/sheets
        'elev-1':    'inset 0 1px 0 0 hsl(0 0% 100% / 0.03), 0 1px 2px 0 hsl(0 0% 0% / 0.55)',
        'elev-2':    'inset 0 1px 0 0 hsl(0 0% 100% / 0.04), 0 4px 12px -2px hsl(0 0% 0% / 0.5)',
        'elev-3':    'inset 0 1px 0 0 hsl(0 0% 100% / 0.05), 0 12px 32px -8px hsl(0 0% 0% / 0.6)',
        'glow-accent':   '0 0 0 1px hsl(var(--accent) / 0.4), 0 0 24px -4px hsl(var(--accent) / 0.35)',
        'glow-critical': '0 0 0 1px hsl(var(--sev-critical) / 0.45), 0 0 24px -4px hsl(var(--sev-critical) / 0.4)',
      },
      backgroundImage: {
        'grid-fade': 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--accent) / 0.08), transparent 60%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart':'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
        '240': '240ms',
      },
      animation: {
        'fade-in':       'fadeIn 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-up':       'fadeUp 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer':       'shimmer 2.4s ease-in-out infinite',
        'pulse-soft':    'pulseSoft 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orbit-slow':    'orbit 40s linear infinite',
        'orbit-reverse': 'orbit 60s linear infinite reverse',
        'scan':          'scan 8s linear infinite',
        'gradient':      'gradient 8s ease infinite',
        'radar-ping':    'radar-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        'glow-pulse':    'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
        orbit: {
          from: { transform: 'rotate(0deg) translateX(20px) rotate(0deg)' },
          to:   { transform: 'rotate(360deg) translateX(20px) rotate(-360deg)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        'radar-ping': {
          '0%':   { transform: 'scale(0.5)', opacity: '0.7' },
          '100%': { transform: 'scale(2.0)', opacity: '0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [animate, require('@tailwindcss/typography')],
}

export default config
