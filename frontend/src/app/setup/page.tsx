'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  Terminal,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

/**
 * First-run setup — informational.
 *
 * Pentagron seeds the admin account from environment variables at server
 * start (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). There is no runtime setup API,
 * so this page is a guided walkthrough of what to do before signing in.
 */
export default function SetupPage() {
  return (
    <AuthLayout
      eyebrow="Getting started"
      title="First-run setup"
      subtitle="Three steps to bring your Pentagron instance online."
    >
      <ol className="flex flex-col gap-3">
        <Step
          index={1}
          icon={KeyRound}
          title="Configure your environment"
          body={
            <>
              Copy the template and set a strong admin password and JWT secret.
              At least one LLM provider key is required.
              <CodeBlock
                className="mt-3"
                lines={[
                  'cp .env.example .env',
                  '# edit .env — set ADMIN_PASSWORD, JWT_SECRET,',
                  '# and at least one of ANTHROPIC_API_KEY / OPENAI_API_KEY',
                ]}
              />
            </>
          }
        />

        <Step
          index={2}
          icon={Terminal}
          title="Bring the stack online"
          body={
            <>
              Build the Kali image, MCP servers, backend and frontend, then
              start every service. First build takes ~10 minutes.
              <CodeBlock
                className="mt-3"
                lines={['make build', 'make up', '# watch: make logs']}
              />
            </>
          }
        />

        <Step
          index={3}
          icon={Sparkles}
          title="Sign in & run your first engagement"
          body={
            <>
              Use the admin credentials you set in <Mono>.env</Mono>. Then
              create a project, define a scope, and launch a flow. Phase gates
              require your approval before any exploitation step runs.
            </>
          }
          isLast
        />
      </ol>

      {/* CTA */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Link href="/login" className="flex-1">
          <Button variant="primary" size="lg" rightIcon={<ArrowRight />} className="w-full justify-center">
            Continue to sign in
          </Button>
        </Link>
      </div>

      {/* Helper row */}
      <div className="mt-6 flex items-center justify-between text-2xs text-fg-subtle font-mono uppercase tracking-widest">
        <span>Docs · github.com/heytherevibin/Pentagron</span>
        <span className="flex items-center gap-1.5">
          <Kbd>⎋</Kbd>
          <span>to cancel</span>
        </span>
      </div>
    </AuthLayout>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

function Step({
  index,
  icon: Icon,
  title,
  body,
  isLast,
}: {
  index: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: React.ReactNode
  isLast?: boolean
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex gap-4"
    >
      {/* Rail */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-md',
            'border border-border-strong bg-bg-subtle ring-inset-hi',
          )}
        >
          <Icon className="h-3.5 w-3.5 text-accent" />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-gradient-to-b from-border-strong via-border to-transparent mt-1" />
        )}
      </div>

      {/* Body */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
            Step {String(index).padStart(2, '0')}
          </span>
        </div>
        <h3 className="mt-1 text-sm font-medium text-fg">{title}</h3>
        <div className="mt-1.5 text-xs leading-relaxed text-fg-muted">{body}</div>
      </div>
    </motion.li>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1 py-0.5 rounded bg-bg-muted border border-border text-[11px] font-mono text-fg">
      {children}
    </code>
  )
}

function CodeBlock({ lines, className }: { lines: string[]; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  const content = lines.join('\n')

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md border border-border bg-bg-muted',
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle bg-bg-subtle/60">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
          <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
          <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
          <span className="ml-2 text-2xs uppercase tracking-widest text-fg-subtle font-mono">
            shell
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'inline-flex items-center gap-1 h-6 px-1.5 rounded text-2xs font-mono',
            'text-fg-subtle hover:text-fg hover:bg-bg-muted/60 transition-colors duration-120',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
          )}
          aria-label="Copy command"
        >
          {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 text-[11.5px] leading-relaxed font-mono text-fg">
        {lines.map((line, i) => (
          <code key={i} className="block">
            {line.startsWith('#') ? (
              <span className="text-fg-subtle">{line}</span>
            ) : (
              <>
                <span className="text-accent/80 select-none">$ </span>
                <span>{line}</span>
              </>
            )}
          </code>
        ))}
      </pre>
    </div>
  )
}
