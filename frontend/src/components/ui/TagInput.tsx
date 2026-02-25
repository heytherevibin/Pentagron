'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/cn'
import { DataLabel } from './DataLabel'

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
  // Allow domains, wildcards, IPs, CIDR ranges
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
    <div className={cn('space-y-1', className)}>
      {label && <DataLabel>{label}</DataLabel>}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 p-2 bg-mc-bg border border-mc-border min-h-[42px]',
          'focus-within:border-mc-emerald',
          error && 'border-mc-crimson',
        )}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-mc-surface border border-mc-border text-mc-text-dim text-xs font-mono"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="text-mc-text-ghost hover:text-mc-crimson ml-0.5"
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
          className="flex-1 min-w-[120px] bg-transparent text-mc-text font-mono text-sm outline-none placeholder:text-mc-text-ghost"
        />
      </div>
      <p className="text-mc-text-ghost text-xxs font-mono">
        press enter or comma to add. domains, IPs, CIDR ranges accepted.
      </p>
      {error && <p className="text-mc-crimson text-xxs font-mono">{error}</p>}
    </div>
  )
}
