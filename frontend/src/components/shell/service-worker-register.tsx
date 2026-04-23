'use client'

import * as React from 'react'

/**
 * ServiceWorkerRegister — mounts once at the root, registers `/sw.js` in
 * production, and quietly unregisters it in development so stale caches
 * never fight HMR. Registration is deferred to `window.load` so it never
 * competes with the critical render path.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // In dev, tear down any previously-registered SW — it would cache routes
    // that HMR is actively rewriting and produce confusing stale UI.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => undefined)
      return
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })

    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
