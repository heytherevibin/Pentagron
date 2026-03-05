import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import '@/styles/grid-overrides.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'PENTAGRON',
  description: 'Autonomous AI penetration testing framework',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-mono antialiased min-h-screen bg-background text-foreground">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--surface-1)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: '0',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '12px',
            },
            success: {
              iconTheme: { primary: '#34d399', secondary: 'var(--surface-1)' },
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: 'var(--surface-1)' },
            },
          }}
        />
      </body>
    </html>
  )
}
