'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, User as UserIcon, LifeBuoy } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { auth } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * UserMenu — avatar dropdown in the topbar. Shows the current operator,
 * provides settings shortcut, and handles sign-out.
 */
export function UserMenu({ email }: { email?: string }) {
  const router = useRouter()
  const initials = React.useMemo(() => {
    if (!email) return '·'
    const [local] = email.split('@')
    return local.slice(0, 2).toUpperCase()
  }, [email])

  async function handleLogout() {
    try {
      await auth.logout().catch(() => undefined)
    } finally {
      localStorage.removeItem('pentagron_token')
      sessionStorage.removeItem('pentagron_token')
      document.cookie = 'pentagron_token=; path=/; max-age=0; samesite=lax'
      toast.success('Signed out')
      router.replace('/login')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-1.5 py-1 min-h-[36px]',
            'hover:bg-bg-subtle transition-colors duration-120',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
            'active:scale-[0.98]',
          )}
        >
          <Avatar className="h-7 w-7 ring-1 ring-border-subtle">
            <AvatarFallback className="text-[10px] font-mono">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-xs text-fg-muted max-w-[160px] truncate">
            {email ?? 'operator'}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
          Signed in as
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs text-fg truncate">{email ?? 'operator'}</div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/settings')}>
          <UserIcon className="h-3.5 w-3.5 text-fg-subtle" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/settings')}>
          <Settings className="h-3.5 w-3.5 text-fg-subtle" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open('https://github.com/heytherevibin/Pentagron', '_blank')}>
          <LifeBuoy className="h-3.5 w-3.5 text-fg-subtle" />
          Docs &amp; support
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleLogout}
          className="text-sev-critical focus:text-sev-critical focus:bg-sev-critical/10"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
