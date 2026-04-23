import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ServiceWorkerRegister } from '@/components/shell/service-worker-register'
import { ThemeProvider } from '@/components/shell/theme-provider'
import { cn } from '@/lib/utils'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Pentagron · Autonomous Penetration Testing',
    template: '%s · Pentagron',
  },
  description:
    'Autonomous AI penetration testing framework — orchestrated multi-agent security assessments with EvoGraph memory.',
  applicationName: 'Pentagron',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pentagron',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Pentagron',
    title: 'Pentagron · Autonomous Penetration Testing',
    description: 'Production-grade, fully automated security assessment platform.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pentagron · Autonomous Penetration Testing',
    description: 'Production-grade, fully automated security assessment platform.',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // WCAG 2.5.4 — never lock zoom; allow users to scale up to 5× for accessibility.
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(GeistSans.variable, GeistMono.variable)}
      style={{
        // Map Geist's default variables onto our design-system names so
        // Tailwind's font-sans / font-mono utilities resolve correctly.
        ['--font-sans' as string]: 'var(--font-geist-sans)',
        ['--font-mono' as string]: 'var(--font-geist-mono)',
      }}
    >
      <head>
        {/* iOS PWA chrome — status bar blends with page, dark UI. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pentagron" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Pentagron" />
        {/* Windows tile */}
        <meta name="msapplication-TileColor" content="#000000" />
        {/* Defensive apple-touch-icon for iOS <Safari 16 that ignores metadata.icons.apple */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className="min-h-screen bg-bg text-fg font-sans antialiased selection:bg-accent/25">
        <a
          href="#main-content"
          className={cn(
            'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]',
            'focus:inline-flex focus:items-center focus:gap-2 focus:h-9 focus:px-3 focus:rounded-md',
            'focus:bg-accent focus:text-accent-fg focus:text-xs focus:font-medium',
            'focus:shadow-pop focus:outline-none',
          )}
        >
          Skip to content
        </a>
        <ThemeProvider>
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
          </TooltipProvider>
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
