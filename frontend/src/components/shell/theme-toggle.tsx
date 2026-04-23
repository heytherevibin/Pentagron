'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * ThemeToggle — three-way switcher (system · light · dark). Uses the same
 * 9×9 bordered icon button language as the command-palette trigger next to
 * it in the topbar so they line up pixel-for-pixel.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const Icon = mounted
    ? theme === 'system'
      ? Monitor
      : resolvedTheme === 'light'
        ? Sun
        : Moon
    : Moon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Toggle theme"
          className={cn(
            'inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md',
            'border border-border bg-bg-subtle/60 ring-inset-hi',
            'text-fg-subtle hover:text-fg hover:bg-bg-muted hover:border-border-strong',
            'transition-colors duration-120',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
          )}
        >
          <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="h-3.5 w-3.5" />
          <span>Light</span>
          {theme === 'light' && <span className="ml-auto text-accent">·</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="h-3.5 w-3.5" />
          <span>Dark</span>
          {theme === 'dark' && <span className="ml-auto text-accent">·</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="h-3.5 w-3.5" />
          <span>System</span>
          {theme === 'system' && <span className="ml-auto text-accent">·</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
