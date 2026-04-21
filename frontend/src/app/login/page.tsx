'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, AlertTriangle, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Kbd } from '@/components/ui/kbd'
import { auth } from '@/lib/api'

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginLayoutFallback />}>
      <LoginPageInner />
    </React.Suspense>
  )
}

/** Shown while the Suspense boundary resolves the search params. */
function LoginLayoutFallback() {
  return (
    <AuthLayout eyebrow="Operator access" title="Sign in to Pentagron">
      <div className="h-[220px]" />
    </AuthLayout>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const emailRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    emailRef.current?.focus()
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const { data } = await auth.login(email.trim(), password)
      localStorage.setItem('pentagron_token', data.token)
      sessionStorage.setItem('pentagron_token', data.token)
      document.cookie = `pentagron_token=${data.token}; path=/; max-age=86400; samesite=lax`
      toast.success('Signed in', {
        description: `Welcome back, ${data.user?.email ?? 'operator'}.`,
      })
      router.replace(redirect)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string }
      const msg =
        e.response?.data?.error ??
        e.response?.data?.message ??
        e.message ??
        'Sign-in failed. Check your credentials and try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Operator access"
      title="Sign in to Pentagron"
      subtitle="Enter your credentials to resume your engagements."
      footerSlot={
        <div className="hidden sm:flex items-center gap-2 text-2xs text-fg-subtle font-mono">
          <span>press</span>
          <Kbd>⏎</Kbd>
          <span>to sign in</span>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {/* ── Error banner ─────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-md border border-sev-critical/30 bg-sev-critical/5 px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-sev-critical mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed text-sev-critical/90">{error}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Email ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="admin@pentagron.local"
            size="lg"
            leftSlot={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        {/* ── Password ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" hint={password ? `${password.length} chars` : undefined}>
            Password
          </Label>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••••"
            size="lg"
            leftSlot={<Lock />}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:text-fg transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          rightIcon={!loading ? <ArrowRight /> : undefined}
          className="mt-2 w-full justify-center"
          disabled={loading || !email || !password}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        {/* ── Secondary row ────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <Link
            href="/setup"
            className="text-fg-muted hover:text-fg transition-colors duration-120 underline-offset-4 hover:underline"
          >
            First-run setup
          </Link>
          <span className="text-fg-subtle font-mono text-2xs uppercase tracking-widest">
            JWT · 24h session
          </span>
        </div>
      </form>

      {/* ── Fine print ─────────────────────────────────────────────────── */}
      <div className="mt-10 rounded-md border border-border-subtle bg-bg-subtle/40 px-3.5 py-3">
        <p className="text-2xs leading-relaxed text-fg-subtle">
          <span className="text-fg-muted font-medium">Authorised use only.</span>{' '}
          Pentagron is intended for security assessments you have explicit written
          permission to conduct. Activity is audit-logged and attributable to your account.
        </p>
      </div>
    </AuthLayout>
  )
}
