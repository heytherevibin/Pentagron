'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { projects as projectsApi } from '@/lib/api'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { DataLabel } from '@/components/ui/DataLabel'
import { TagInput } from '@/components/ui/TagInput'
import { cn } from '@/lib/cn'

type Provider = 'anthropic' | 'openai' | 'openrouter' | 'deepseek' | 'ollama'

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: 'anthropic',  label: 'Anthropic' },
  { value: 'openai',     label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek',   label: 'DeepSeek' },
  { value: 'ollama',     label: 'Ollama' },
]

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [llmKey, setLlmKey] = useState('')
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectScope, setProjectScope] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingProjects, setCheckingProjects] = useState(true)

  // If projects already exist, redirect to dashboard
  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const data = res.data
        const list = Array.isArray(data) ? data : data?.data ?? data?.projects ?? []
        if (list.length > 0) {
          router.push('/')
        } else {
          setCheckingProjects(false)
        }
      })
      .catch(() => {
        setCheckingProjects(false)
      })
  }, [router])

  async function handleComplete() {
    setLoading(true)
    try {
      const res = await projectsApi.create({
        name: projectName,
        description: projectDesc,
        scope: projectScope.join(', '),
      })
      const project = res.data?.data ?? res.data
      router.push(`/projects/${project.id}`)
    } catch {
      setLoading(false)
    }
  }

  if (checkingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-mc-text-dim text-sm font-mono animate-pulse">INITIALIZING...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold font-mono text-mc-emerald">[PENTAGRON]</h1>
          <div className="text-xxs font-mono font-medium uppercase tracking-widest-plus text-mc-text-muted">
            FIRST-TIME SETUP
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-0">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 flex items-center justify-center text-xs font-mono font-bold border',
                  s === step
                    ? 'bg-mc-emerald text-mc-bg border-mc-emerald'
                    : s < step
                      ? 'bg-mc-emerald/20 text-mc-emerald border-mc-emerald/40'
                      : 'bg-mc-bg text-mc-text-ghost border-mc-border',
                )}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    'w-16 h-px',
                    s < step ? 'bg-mc-emerald/40' : 'bg-mc-border',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step labels */}
        <div className="flex items-center justify-center gap-0 -mt-3">
          {['CONFIGURE', 'CREATE PROJECT', 'LAUNCH'].map((label, i) => (
            <div key={label} className={cn('text-center', i < 2 ? 'w-24 mr-16' : 'w-24')}>
              <span
                className={cn(
                  'text-xxs font-mono uppercase tracking-wider',
                  i + 1 === step ? 'text-mc-emerald' : 'text-mc-text-ghost',
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <Panel title={step === 1 ? 'CONFIGURE LLM PROVIDER' : step === 2 ? 'CREATE PROJECT' : 'REVIEW & LAUNCH'}>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <DataLabel>PROVIDER</DataLabel>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full bg-mc-bg border border-mc-border text-mc-text font-mono text-sm px-3 py-2 focus:border-mc-emerald focus:outline-none"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="API KEY"
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-••••••••••••••••"
              />

              <p className="text-xxs font-mono text-mc-text-ghost">
                Your API key is stored locally and sent to the backend over an encrypted connection.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="PROJECT NAME"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. ACME Corp External Pentest"
              />

              <Textarea
                label="DESCRIPTION"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Describe the engagement objective..."
                rows={3}
              />

              <TagInput
                label="TARGET SCOPE"
                tags={projectScope}
                onAdd={(tag) => setProjectScope((prev) => [...prev, tag])}
                onRemove={(tag) => setProjectScope((prev) => prev.filter((t) => t !== tag))}
                placeholder="e.g. *.acme.com, 10.0.0.0/24"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-3 text-sm font-mono">
                <div className="flex items-start justify-between border-b border-mc-border pb-2">
                  <DataLabel>PROVIDER</DataLabel>
                  <span className="text-mc-text">{provider.toUpperCase()}</span>
                </div>
                <div className="flex items-start justify-between border-b border-mc-border pb-2">
                  <DataLabel>API KEY</DataLabel>
                  <span className="text-mc-text-dim">
                    {llmKey ? `${llmKey.slice(0, 6)}${'•'.repeat(12)}` : '(not set)'}
                  </span>
                </div>
                <div className="flex items-start justify-between border-b border-mc-border pb-2">
                  <DataLabel>PROJECT</DataLabel>
                  <span className="text-mc-text">{projectName || '(unnamed)'}</span>
                </div>
                <div className="flex items-start justify-between border-b border-mc-border pb-2">
                  <DataLabel>DESCRIPTION</DataLabel>
                  <span className="text-mc-text-dim text-right max-w-[60%] truncate">
                    {projectDesc || '(none)'}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <DataLabel>SCOPE</DataLabel>
                  <div className="flex flex-wrap justify-end gap-1 max-w-[60%]">
                    {projectScope.length > 0 ? (
                      projectScope.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 bg-mc-bg border border-mc-border text-mc-text-dim text-xs font-mono"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-mc-text-ghost text-xs">(none)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              >
                BACK
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/')}>
              SKIP
            </Button>

            {step < 3 ? (
              <Button
                variant="primary"
                onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
              >
                NEXT
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={loading}
                onClick={handleComplete}
              >
                INITIALIZE FIRST FLOW
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
