'use client'

import * as React from 'react'

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
  return <Shell email={email}>{children}</Shell>
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
