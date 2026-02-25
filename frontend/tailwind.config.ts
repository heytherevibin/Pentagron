import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '2px',
      md: '3px',
      lg: '4px',
      full: '9999px',
    },
    extend: {
      colors: {
        mc: {
          bg:               '#0a0e1a',
          'bg-alt':         '#0d1220',
          surface:          '#111827',
          'surface-hover':  '#1a2236',
          border:           '#1e293b',
          'border-bright':  '#334155',
          text:             '#e2e8f0',
          'text-dim':       '#94a3b8',
          'text-muted':     '#64748b',
          'text-ghost':     '#475569',
          emerald:          '#10b981',
          'emerald-dim':    '#059669',
          'emerald-glow':   '#10b98133',
          crimson:          '#dc2626',
          'crimson-dim':    '#b91c1c',
          'crimson-glow':   '#dc262633',
          amber:            '#d97706',
          'amber-dim':      '#b45309',
          blue:             '#3b82f6',
          'blue-dim':       '#2563eb',
          violet:           '#7c3aed',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xxs: ['0.625rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        'widest-plus': '0.15em',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-emerald': 'glow-emerald 2s ease-in-out infinite',
        'glow-crimson': 'glow-crimson 2s ease-in-out infinite',
        'glow-amber': 'glow-amber 2s ease-in-out infinite',
        'glow-blue': 'glow-blue 2s ease-in-out infinite',
        blink: 'blink 1s step-end infinite',
        skeleton: 'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        'glow-emerald': {
          '0%, 100%': { boxShadow: '0 0 4px 0 #10b98166' },
          '50%': { boxShadow: '0 0 12px 2px #10b98144' },
        },
        'glow-crimson': {
          '0%, 100%': { boxShadow: '0 0 4px 0 #dc262666' },
          '50%': { boxShadow: '0 0 12px 2px #dc262644' },
        },
        'glow-amber': {
          '0%, 100%': { boxShadow: '0 0 4px 0 #d9770666' },
          '50%': { boxShadow: '0 0 12px 2px #d9770644' },
        },
        'glow-blue': {
          '0%, 100%': { boxShadow: '0 0 4px 0 #3b82f666' },
          '50%': { boxShadow: '0 0 12px 2px #3b82f644' },
        },
        blink: {
          '50%': { opacity: '0' },
        },
        skeleton: {
          '0%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
          '100%': { opacity: '0.4' },
        },
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
