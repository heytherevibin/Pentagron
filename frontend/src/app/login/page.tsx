'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, api } from '@/lib/api'
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

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('pentagron_token')) {
      router.push('/')
    }
  }, [router])

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
    <div className="auth-layout">
      {/* Brand panel (left) */}
      <div className="auth-brand">
        <div className="auth-brand-waves" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-blue-500 text-2xl font-bold tracking-tight">[P]</span>
            <span className="text-foreground text-lg font-semibold tracking-tight">PENTAGRON</span>
          </div>
          <p className="text-muted text-xs mt-1">Autonomous Penetration Testing Framework</p>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <div className="w-12 h-[2px] bg-blue-500 mb-4" />
            <h2 className="text-foreground text-xl font-semibold tracking-tight leading-tight">
              AI-Powered Offensive
              <br />
              Security Operations
            </h2>
            <p className="text-muted text-xs mt-3 max-w-md leading-relaxed">
              Automated reconnaissance, vulnerability discovery, exploitation,
              and post-exploitation with full audit trails and phase-gated approvals.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <GlowDot
            status={systemOnline === null ? 'offline' : systemOnline ? 'ok' : 'error'}
            size="sm"
          />
          <span className="text-muted text-[10px] uppercase tracking-widest-plus">
            {systemOnline === null
              ? 'Checking system...'
              : systemOnline
                ? 'System Online'
                : 'System Offline'}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="auth-divider" />

      {/* Auth form (right) */}
      <div className="auth-main">
        <div className="auth-form-wrap space-y-8">
          {/* System status (mobile only) */}
          <div className="flex items-center gap-2 lg:hidden">
            <GlowDot
              status={systemOnline === null ? 'offline' : systemOnline ? 'ok' : 'error'}
              size="sm"
            />
            <span className="text-muted text-[10px] uppercase tracking-widest-plus">
              {systemOnline === null
                ? 'Checking...'
                : systemOnline
                  ? 'System Online'
                  : 'System Offline'}
            </span>
          </div>

          {/* Header */}
          <div>
            <p className="text-muted text-[10px] uppercase tracking-widest-plus mb-3">Sign In</p>
            <h1 className="text-foreground text-lg font-semibold tracking-tight">
              Authenticate to continue
            </h1>
            <p className="text-muted text-xs mt-1">
              Enter your operator credentials
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/5 border border-red-500/20 p-3">
              <span className="text-red-400 text-xs font-mono font-bold">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
              className="w-full h-9"
            >
              Authenticate
            </Button>
          </form>

          {/* Footer */}
          <p className="text-muted text-[10px] text-center">
            Pentagron v0.1.0
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-muted text-xs font-mono animate-pulse">Loading...</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
