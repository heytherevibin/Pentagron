'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * ErrorState — the canonical "something broke" panel rendered by every
 * `error.tsx` boundary. Reset button re-invokes the segment, and we surface
 * a digest-hash so operators can correlate with the server log.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error interrupted this view. The issue has been reported.',
  error,
  reset,
  home = true,
}: {
  title?: string
  description?: string
  error?: Error & { digest?: string }
  reset?: () => void
  home?: boolean
}) {
  React.useEffect(() => {
    if (error) {
      // Structured so future Sentry/Logtail drop-in auto-captures.
      console.error('[Pentagron] boundary caught', {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      })
    }
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="max-w-md w-full border-danger/30">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-danger/40 bg-danger/10">
            <AlertTriangle className="h-5 w-5 text-danger" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
            {error?.digest && (
              <p className="mt-3 meta-mono">digest · {error.digest}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {reset && (
              <Button size="sm" onClick={reset} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            )}
            {home && (
              <Button asChild size="sm" variant="ghost" className="gap-1.5">
                <Link href="/">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
