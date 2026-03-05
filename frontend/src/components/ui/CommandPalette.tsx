'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/cn'

interface CommandItem {
  id: string
  label: string
  category: 'Pages' | 'Quick Actions' | 'System'
  href?: string
  action?: () => void
}

const COMMANDS: CommandItem[] = [
  { id: 'page-dashboard',  label: 'Dashboard',       category: 'Pages',         href: '/' },
  { id: 'page-settings',   label: 'Settings',        category: 'Pages',         href: '/settings' },
  { id: 'action-new',      label: 'New Project',     category: 'Quick Actions', href: '/projects/new' },
  { id: 'system-refresh',  label: 'Refresh Data',    category: 'System' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const filtered = COMMANDS.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const flatFiltered = Object.values(grouped).flat()

  const executeItem = useCallback((item: CommandItem) => {
    setOpen(false)
    if (item.href) {
      router.push(item.href)
    } else if (item.action) {
      item.action()
    } else if (item.id === 'system-refresh') {
      window.location.reload()
    }
  }, [router])

  const onInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, flatFiltered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatFiltered[activeIndex]) {
        executeItem(flatFiltered[activeIndex])
      }
    }
  }, [flatFiltered, activeIndex, executeItem])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const activeEl = list.querySelector(`[data-index="${activeIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 bg-surface-1 border border-border shadow-2xl focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          {/* Search input */}
          <div className="border-b border-border p-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Type a command..."
              className="w-full bg-background border border-border px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
            {flatFiltered.length === 0 ? (
              <div className="px-3 py-6 text-center text-muted text-xs font-mono">
                No results
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-widest-plus text-muted">
                    {category}
                  </div>
                  {items.map((item) => {
                    const globalIndex = flatFiltered.indexOf(item)
                    return (
                      <button
                        key={item.id}
                        data-index={globalIndex}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm font-mono text-muted cursor-pointer transition-colors',
                          globalIndex === activeIndex && 'bg-surface-2 text-foreground',
                        )}
                      >
                        {item.label}
                        {item.href && (
                          <span className="ml-2 text-[10px] text-muted">{item.href}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-border px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted">
              ESC to close
            </span>
            <span className="text-[10px] font-mono text-muted">
              <span className="px-1 py-0.5 border border-border mr-1">&uarr;</span>
              <span className="px-1 py-0.5 border border-border mr-1">&darr;</span>
              navigate
              <span className="ml-2 px-1 py-0.5 border border-border">&#9166;</span>
              {' '}select
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
