'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, Cpu, Network, Workflow } from 'lucide-react'
import { AuthBackdrop } from './auth-backdrop'
import { Wordmark } from '@/components/ui/wordmark'
import { StatusDot } from '@/components/ui/status-dot'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/**
 * AuthLayout — a split-screen shell used by /login and /setup.
 *
 *   [  Brand / Hero (parallax backdrop, wordmark, marketing copy)  | Form  ]
 *
 * On narrow viewports the brand panel collapses behind the form. Form panel
 * stays true-black, absolutely legible at any screen size.
 */
export function AuthLayout({
  children,
  eyebrow,
  title,
  subtitle,
  footerSlot,
}: {
  /** Form content (renders in the right panel). */
  children: React.ReactNode
  /** Small uppercase label above the form title. */
  eyebrow?: string
  /** Form panel title (h1). */
  title: string
  /** Form panel secondary line. */
  subtitle?: string
  /** Optional footer content, right-aligned in the form panel. */
  footerSlot?: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen w-full grid lg:grid-cols-[1.15fr_1fr] bg-bg overflow-hidden">
      {/* ════ Brand panel (left, hidden on mobile) ════════════════════════════ */}
      <aside className="relative hidden lg:flex flex-col justify-between p-10 border-r border-border">
        <AuthBackdrop />

        {/* Top — Wordmark */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <Wordmark className="text-2xl" />
          </Link>

          <div className="flex items-center gap-2">
            <StatusDot tone="accent" pulse size={6} />
            <span className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
              v0.3.1 · online
            </span>
          </div>
        </div>

        {/* Middle — Hero copy */}
        <div className="relative z-10 max-w-xl">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-bg-subtle/60 backdrop-blur-sm text-2xs uppercase tracking-widest text-fg-muted font-mono"
          >
            <span className="h-1 w-1 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.7)]" />
            Autonomous · Multi-agent · Auditable
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 text-4xl lg:text-5xl tracking-tighter font-medium leading-[1.05] text-gradient"
          >
            The offensive security <br />
            platform that thinks.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 max-w-md text-sm leading-relaxed text-fg-muted"
          >
            Pentagron orchestrates reasoning agents through a five-phase pipeline —
            from passive reconnaissance to post-exploitation reporting — with human
            approval gates and cross-engagement memory.
          </motion.p>

          {/* Feature strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.36, duration: 0.5 }}
            className="mt-8 grid grid-cols-2 gap-3 max-w-lg"
          >
            <FeatureChip icon={Workflow} label="ReAct pipeline" detail="Reason · Act · Observe" />
            <FeatureChip icon={Network}  label="EvoGraph"      detail="Cross-session memory" />
            <FeatureChip icon={Cpu}      label="5 providers"   detail="Claude · GPT · Ollama" />
            <FeatureChip icon={ShieldCheck} label="Phase gates" detail="Human-in-the-loop" />
          </motion.div>
        </div>

        {/* Bottom — Legal strip */}
        <div className="relative z-10 flex items-center justify-between text-2xs text-fg-subtle font-mono">
          <span className="uppercase tracking-widest">Authorised use only</span>
          <span className="uppercase tracking-widest">© Pentagron</span>
        </div>
      </aside>

      {/* ════ Form panel (right, always visible) ═════════════════════════════ */}
      <main className="relative flex flex-col min-h-screen">
        {/* Faint grid for the form side too — much subtler than the brand panel */}
        <div
          aria-hidden
          className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none"
          style={{
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000, transparent 80%)',
          }}
        />

        {/* Mobile-only top bar with the wordmark */}
        <div className="relative z-10 flex items-center justify-between p-5 lg:hidden border-b border-border">
          <Link href="/"><Wordmark className="text-xl" /></Link>
          <StatusDot tone="accent" pulse size={6} />
        </div>

        {/* Form content centered */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-12 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[380px]"
          >
            {eyebrow && (
              <div className="text-2xs uppercase tracking-widest text-accent font-mono mb-4">
                {eyebrow}
              </div>
            )}
            <h2 className="text-2xl tracking-tight font-medium text-fg">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}

            <div className="mt-8">{children}</div>
          </motion.div>
        </div>

        {/* Footer strip */}
        <div className="relative z-10 flex items-center justify-between px-5 py-4 lg:px-12 border-t border-border-subtle">
          <div className="flex items-center gap-3 text-2xs text-fg-subtle font-mono uppercase tracking-widest">
            <span>Pentagron</span>
            <Separator orientation="vertical" className="h-3" />
            <span>Secured by JWT</span>
          </div>
          {footerSlot}
        </div>
      </main>
    </div>
  )
}

function FeatureChip({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  detail: string
}) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-md border border-border bg-bg-subtle/50 backdrop-blur-sm',
        'px-3 py-2.5 transition-colors duration-180',
        'hover:bg-bg-muted/60 hover:border-border-strong',
      )}
    >
      <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-bg-muted">
        <Icon className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-fg leading-none">{label}</div>
        <div className="mt-1 text-2xs text-fg-subtle font-mono truncate">{detail}</div>
      </div>
    </div>
  )
}
