'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'

import { Shell } from '@/components/shell/shell'

/**
 * Authenticated layout — wraps every page that requires a session with the
 * Pentagron application shell (sidebar + topbar + command palette).
 *
 * Route gating is handled by `src/middleware.ts`, which redirects any
 * unauthenticated request for a protected path to /login. This component
 * therefore assumes a valid session exists; it only reads the token client-side
 * to render the operator email in the user menu.
 */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const email = useOperatorEmail()
  // Suspense wrapper absorbs `useSearchParams()` CSR-bailouts from any page
  // that uses the URL-state hook (URL-synced filters on lists, windows on
  // insights, tabs on flow detail, etc). Without this every such page would
  // need its own boundary; wrapping once here keeps pages terse.
  const pathname = usePathname()
  const reduce = useReducedMotion()
  return (
    <Shell email={email}>
      <React.Suspense fallback={null}>
        {/*
          Subtle keyed fade+rise on route change. Keeps spatial continuity
          without the cost/flicker of AnimatePresence wait-mode. Distance
          collapses to 0 when the user prefers reduced motion.
        */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </React.Suspense>
    </Shell>
  )
}

/**
 * Decode the operator email out of the JWT payload without validating the
 * signature (the server is the source of truth — we only need the claim for
 * display). Falls back to undefined on any parse failure.
 */
function useOperatorEmail(): string | undefined {
  const [email, setEmail] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    try {
      const token =
        sessionStorage.getItem('pentagron_token') ??
        localStorage.getItem('pentagron_token')
      if (!token) return
      const payload = token.split('.')[1]
      if (!payload) return
      const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
      const json = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '=')))
      if (typeof json.email === 'string') setEmail(json.email)
      else if (typeof json.sub === 'string') setEmail(json.sub)
    } catch {
      /* ignore */
    }
  }, [])
  return email
}
