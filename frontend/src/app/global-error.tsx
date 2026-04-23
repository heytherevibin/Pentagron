'use client'

/**
 * global-error.tsx — last-resort boundary that wraps the ENTIRE document.
 * Only renders when a crash happens in the root layout itself. Must provide
 * its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#000',
          color: '#EDEDED',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#71717A',
              marginBottom: 12,
            }}
          >
            Pentagron
          </div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px', fontWeight: 600 }}>
            Application crashed
          </h1>
          <p style={{ fontSize: 14, color: '#A1A1AA', margin: '0 0 20px' }}>
            A fatal error escaped every boundary. Reload to recover.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                color: '#71717A',
                marginBottom: 20,
              }}
            >
              digest · {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#00DC82',
              color: '#000',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
