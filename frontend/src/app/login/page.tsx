'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, api } from '@/lib/api'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { GlowDot } from '@/components/ui/GlowDot'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systemOnline, setSystemOnline] = useState<boolean | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('pentagron_token')) {
      router.push('/')
    }
  }, [router])

  // Check system health on mount
  useEffect(() => {
    api.get('/health')
      .then(() => setSystemOnline(true))
      .catch(() => setSystemOnline(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await auth.login(email, password)
      const token = res.data?.token
      if (!token) {
        setError('INVALID SERVER RESPONSE')
        return
      }

      localStorage.setItem('pentagron_token', token)
      document.cookie = `pentagron_token=${token}; path=/; SameSite=Lax`

      const redirect = searchParams.get('redirect') || '/'
      router.push(redirect)
    } catch {
      setError('ACCESS DENIED')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Title area */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold font-mono text-mc-emerald">[PENTAGRON]</h1>
          <div className="text-xxs font-mono font-medium uppercase tracking-widest-plus text-mc-text-muted">
            MISSION CONTROL
          </div>
          <div className="text-mc-text-ghost text-xxs font-mono">v0.1.0</div>
        </div>

        {/* Login card */}
        <Panel title="AUTHENTICATION" className="w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-mc-crimson/10 border border-mc-crimson/40 p-3">
                <span className="text-mc-crimson text-xs font-mono font-bold">{error}</span>
              </div>
            )}

            <Input
              label="OPERATOR ID"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@pentagron.local"
              autoComplete="email"
              required
            />

            <Input
              label="ACCESS KEY"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full"
            >
              AUTHENTICATE
            </Button>
          </form>
        </Panel>

        {/* System status */}
        <div className="flex items-center justify-center gap-2">
          <GlowDot
            status={systemOnline === null ? 'offline' : systemOnline ? 'ok' : 'error'}
            size="sm"
          />
          <span className="text-xxs font-mono uppercase tracking-widest-plus text-mc-text-muted">
            {systemOnline === null
              ? 'CHECKING SYSTEM...'
              : systemOnline
                ? 'SYSTEM ONLINE'
                : 'SYSTEM OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-mc-text-ghost text-xs font-mono animate-blink">LOADING...</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
