'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Wordmark } from '@/components/ui/wordmark'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS } from './nav-config'

/** MobileNav — slide-in drawer that mirrors the desktop sidebar navigation. */
export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const pathname = usePathname() ?? '/'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className={cn(
          'w-[min(85vw,300px)] p-0 bg-bg border-border',
          // honour notch on the leading edge when installed as PWA
          'pl-[env(safe-area-inset-left)]',
        )}
      >
        <SheetHeader className="h-14 px-4 flex flex-row items-center justify-start border-b border-border-subtle">
          <SheetTitle className="flex items-center">
            <Wordmark className="text-lg" />
          </SheetTitle>
        </SheetHeader>

        <nav className="px-2 py-3 overflow-y-auto max-h-[calc(100dvh-3.5rem)]">
          <ul className="flex flex-col gap-5">
            {NAV_SECTIONS.map((section) => (
              <li key={section.label}>
                <div className="px-2 pb-1.5 text-2xs uppercase tracking-widest text-fg-subtle font-mono">
                  {section.label}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const active = item.match ? item.match(pathname) : pathname.startsWith(item.href)
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'inline-flex items-center gap-3 w-full rounded-md h-11 px-3',
                            'transition-colors duration-120',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                            active
                              ? 'bg-bg-subtle text-fg'
                              : 'text-fg-muted hover:text-fg hover:bg-bg-subtle/60 active:bg-bg-subtle',
                          )}
                        >
                          <Icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-fg-subtle')} />
                          <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <Separator className="mx-3 w-auto" />
      </SheetContent>
    </Sheet>
  )
}
