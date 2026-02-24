import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pentagron brand palette — dark terminal aesthetic
        pentagron: {
          bg:      '#0a0e1a',
          surface: '#111827',
          border:  '#1f2937',
          primary: '#00ff88',   // green terminal accent
          danger:  '#ff4444',   // red for critical findings
          warning: '#ffaa00',   // orange for high severity
          info:    '#3b82f6',   // blue for info
          muted:   '#6b7280',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
