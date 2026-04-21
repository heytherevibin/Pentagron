'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Target } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { projects } from '@/lib/api'

/**
 * New project — minimal three-field form: name, description, scope. Scope is
 * the freeform definition of what's in-bounds for the engagement (one line
 * per target / CIDR / URL). Written to the backend verbatim.
 */
export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [scope, setScope] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nameRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    nameRef.current?.focus()
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const { data } = await projects.create({
        name: name.trim(),
        description: description.trim() || undefined,
        scope: scope.trim() || undefined,
      })
      const created = (data as { project?: { id: string } }).project
      toast.success('Project created', { description: name })
      if (created?.id) {
        router.replace(`/projects/${created.id}`)
      } else {
        router.replace('/projects')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string }
      const msg =
        e.response?.data?.error ??
        e.response?.data?.message ??
        e.message ??
        'Could not create project. Try again.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        backHref="/projects"
        backLabel="All projects"
        eyebrow="New engagement"
        title="Create a project"
        subtitle="Scope the engagement, assign targets, and invite your flows."
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 max-w-[1040px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Project details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name" hint="required">
                  Name
                </Label>
                <Input
                  ref={nameRef}
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ACME · Q2 external assessment"
                  size="md"
                  disabled={loading}
                  required
                  maxLength={120}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objectives, stakeholders, rules of engagement…"
                  disabled={loading}
                  rows={3}
                  maxLength={2000}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scope" hint="one target per line">
                  Scope
                </Label>
                <Textarea
                  id="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder={'example.com\n*.staging.example.com\n203.0.113.0/24'}
                  disabled={loading}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="text-xs text-fg-muted hover:text-fg transition-colors duration-120"
                  disabled={loading}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={loading}
                  rightIcon={!loading ? <ArrowRight /> : undefined}
                  disabled={loading || !name.trim()}
                >
                  {loading ? 'Creating…' : 'Create project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Side panel — authorised-use reminder */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-accent" />
                Scope matters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs leading-relaxed text-fg-muted">
              Pentagron agents will refuse to act on anything outside this list. Every
              in-scope target you add is treated as authorised — make sure you have
              written permission before including it.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What happens next</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="flex flex-col gap-2.5 text-xs text-fg-muted">
                <NextStep num={1} label="Create the project" done />
                <NextStep num={2} label="Launch a flow from the project page" />
                <NextStep num={3} label="Approve phase gates as they appear" />
                <NextStep num={4} label="Review the final report & EvoGraph" />
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

function NextStep({ num, label, done }: { num: number; label: string; done?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-2xs font-mono shrink-0 ${
          done
            ? 'bg-accent/10 border-accent/40 text-accent'
            : 'bg-bg-muted border-border text-fg-subtle'
        }`}
      >
        {num}
      </span>
      <span className={done ? 'text-fg' : undefined}>{label}</span>
    </li>
  )
}
