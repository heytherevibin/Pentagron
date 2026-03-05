'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/cn'

interface TagInputProps {
  label?: string
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  placeholder?: string
  error?: string
  className?: string
}

function isValidTarget(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const pattern = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/
  return pattern.test(trimmed)
}

export function TagInput({ label, tags, onAdd, onRemove, placeholder, error, className }: TagInputProps) {
  const [input, setInput] = useState('')

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = input.trim().replace(/,+$/, '')
      if (value && isValidTarget(value) && !tags.includes(value)) {
        onAdd(value)
        setInput('')
      }
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    }
  }, [input, tags, onAdd, onRemove])

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="section-label">{label}</label>}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 p-2 bg-surface-1 border border-border min-h-[42px]',
          'focus-within:border-blue-500/50',
          error && 'border-red-500/50',
        )}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border text-foreground text-xs font-mono"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="text-muted hover:text-red-400 ml-0.5"
            >
              x
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-foreground font-mono text-xs outline-none placeholder:text-muted"
        />
      </div>
      <p className="text-muted text-[10px] font-mono">
        press enter or comma to add. domains, IPs, CIDR ranges accepted.
      </p>
      {error && <p className="text-red-400 text-[10px] font-mono">{error}</p>}
    </div>
  )
}
