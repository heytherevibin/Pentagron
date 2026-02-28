'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { projects } from '@/lib/api'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { TagInput } from '@/components/ui/TagInput'
import { Button } from '@/components/ui/Button'
import { PageContentShell } from '@/components/layout/PageContentShell'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const res = await projects.create({
        name: name.trim(),
        description: description.trim(),
        scope: tags.join(', '),
      })
      const id = res.data?.id ?? res.data?.data?.id
      if (!id) {
        toast.error('Invalid response: no project id')
        return
      }
      toast.success('Project initialized')
      router.push(`/projects/${id}`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null
      toast.error(msg && typeof msg === 'string' ? msg : 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageContentShell>
      <div className="animate-fade-in space-y-6">
        {/* Page header — same structure as project detail */}
        <div>
          <h1 className="page-title">New Engagement</h1>
          <p className="page-subtitle">Configure a new penetration testing project</p>
        </div>

        {/* Single full-width panel — matches PROJECT INFO / ENGAGEMENT FLOWS layout */}
        <form onSubmit={handleSubmit}>
          <Panel title="PROJECT CONFIGURATION" contentClassName="space-y-5">
            <Input
              label="PROJECT NAME"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client-A External Penetration Test"
            />

            <Textarea
              label="DESCRIPTION"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full external penetration test for..."
            />

            <TagInput
              label="TARGET SCOPE"
              tags={tags}
              onAdd={(tag) => setTags((prev) => [...prev, tag])}
              onRemove={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
              placeholder="*.example.com, 10.0.0.0/24"
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
              >
                Initialize Project
              </Button>
            </div>
          </Panel>
        </form>
      </div>
    </PageContentShell>
  )
}
