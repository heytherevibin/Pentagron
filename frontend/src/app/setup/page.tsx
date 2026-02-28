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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-muted text-sm font-mono animate-pulse">Initializing...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-xl space-y-6">
        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold font-mono text-blue-500">[PENTAGRON]</h1>
          <div className="text-[10px] font-mono font-medium uppercase tracking-widest-plus text-muted">
            First-time Setup
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
                    ? 'bg-blue-600 text-white border-blue-600'
                    : s < step
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-background text-muted border-border',
                )}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    'w-16 h-px',
                    s < step ? 'bg-blue-500/40' : 'bg-border',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step labels */}
        <div className="flex items-center justify-center gap-0 -mt-3">
          {['Configure', 'Create Project', 'Launch'].map((label, i) => (
            <div key={label} className={cn('text-center', i < 2 ? 'w-24 mr-16' : 'w-24')}>
              <span
                className={cn(
                  'text-[10px] font-mono uppercase tracking-wider',
                  i + 1 === step ? 'text-blue-400' : 'text-muted',
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
              <div className="space-y-1.5">
                <DataLabel>PROVIDER</DataLabel>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full bg-surface-1 border border-border text-foreground font-mono text-sm px-3 py-2 focus:border-blue-500/50 focus:outline-none"
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

              <p className="text-[10px] font-mono text-muted">
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
                <div className="flex items-start justify-between border-b border-border pb-2">
                  <DataLabel>PROVIDER</DataLabel>
                  <span className="text-foreground">{provider.toUpperCase()}</span>
                </div>
                <div className="flex items-start justify-between border-b border-border pb-2">
                  <DataLabel>API KEY</DataLabel>
                  <span className="text-muted">
                    {llmKey ? `${llmKey.slice(0, 6)}${'•'.repeat(12)}` : '(not set)'}
                  </span>
                </div>
                <div className="flex items-start justify-between border-b border-border pb-2">
                  <DataLabel>PROJECT</DataLabel>
                  <span className="text-foreground">{projectName || '(unnamed)'}</span>
                </div>
                <div className="flex items-start justify-between border-b border-border pb-2">
                  <DataLabel>DESCRIPTION</DataLabel>
                  <span className="text-muted text-right max-w-[60%] truncate">
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
                          className="px-2 py-0.5 bg-surface-2 border border-border text-muted text-xs font-mono"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted text-xs">(none)</span>
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
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/')}>
              Skip
            </Button>

            {step < 3 ? (
              <Button
                variant="primary"
                onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={loading}
                onClick={handleComplete}
              >
                Initialize First Flow
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
