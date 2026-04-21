import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Pentagron · Autonomous Penetration Testing',
    template: '%s · Pentagron',
  },
  description:
    'Autonomous AI penetration testing framework — orchestrated multi-agent security assessments with EvoGraph memory.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.svg',
    apple: '/icons/icon-192x192.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Pentagron',
    title: 'Pentagron · Autonomous Penetration Testing',
    description: 'Production-grade, fully automated security assessment platform.',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(GeistSans.variable, GeistMono.variable, 'dark')}
      style={{
        // Map Geist's default `--font-geist-sans` / `--font-geist-mono`
        // onto our design-system variable names so Tailwind picks them up.
        // (The geist/font package sets these automatically; this is a
        // defensive alias in case of any naming mismatch.)
        ['--font-sans' as string]: 'var(--font-geist-sans)',
        ['--font-mono' as string]: 'var(--font-geist-mono)',
      }}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-bg text-fg font-sans antialiased selection:bg-accent/25">
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
