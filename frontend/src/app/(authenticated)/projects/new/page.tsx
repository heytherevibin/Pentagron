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
      toast.success('Project initialized')
      router.push(`/projects/${id}`)
    } catch {
      toast.error('Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-start justify-center min-h-[calc(100vh-4rem)] p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <Panel title="NEW ENGAGEMENT">
          <div className="space-y-5">
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

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-mc-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
              >
                Initialize Project
              </Button>
            </div>
          </div>
        </Panel>
      </form>
    </div>
  )
}
