'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  MoreHorizontal,
  KeyRound,
  ShieldOff,
  UserPlus,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { users as usersApi } from '@/lib/api'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import type { User } from '@/types'

import { SettingsCard } from './settings-card'

const ROLES: Array<User['role']> = ['admin', 'operator', 'viewer']

export function UsersSettings() {
  const { data, isLoading, mutate } = useSWR('/api/users', () =>
    usersApi.list().then((r) => r.data as { users?: User[] }),
  )
  const list = data?.users ?? []

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Operators"
        description="Control who can sign in and what they can do. Roles cascade: admin → operator → viewer."
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-2xs uppercase tracking-widest text-fg-subtle font-mono">
              {list.length} {list.length === 1 ? 'account' : 'accounts'}
            </span>
            <NewUserDialog onCreated={() => mutate()} />
          </div>
        }
      >
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : list.length === 0 ? (
          <div className="py-6 text-center text-xs text-fg-subtle">
            No users yet. Invite your first operator above.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle -my-2">
            {list.map((u) => (
              <UserRow key={u.id} user={u} onMutate={() => mutate()} />
            ))}
          </ul>
        )}
      </SettingsCard>
    </div>
  )
}

function UserRow({ user, onMutate }: { user: User; onMutate: () => void }) {
  const initials = (user.email.split('@')[0] ?? '·').slice(0, 2).toUpperCase()
  const [busy, setBusy] = React.useState(false)

  async function setRole(role: User['role']) {
    if (busy || role === user.role) return
    setBusy(true)
    try {
      await usersApi.update(user.id, { role })
      toast.success('Role updated', { description: `${user.email} → ${role}` })
      onMutate()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not update role', { description: e.response?.data?.error })
    } finally {
      setBusy(false)
    }
  }

  async function deactivate() {
    if (busy) return
    if (!confirm(`Deactivate ${user.email}? They will be signed out and cannot sign back in.`)) return
    setBusy(true)
    try {
      await usersApi.deactivate(user.id)
      toast.success('User deactivated')
      onMutate()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not deactivate', { description: e.response?.data?.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px] font-mono">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-xs font-medium text-fg truncate">{user.email}</div>
          <div className="mt-0.5 text-2xs text-fg-subtle font-mono">
            Added {timeAgo(user.created_at)} · {formatDateTime(user.created_at)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Badge
          variant="outline"
          className={cn(
            'uppercase',
            user.role === 'admin' && 'text-accent border-accent/40',
            user.role === 'operator' && 'text-fg border-border-strong',
            user.role === 'viewer' && 'text-fg-subtle border-border',
          )}
        >
          {user.role}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55"
              aria-label="User actions"
              disabled={busy}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-56">
            <div className="px-2 py-1 text-2xs uppercase tracking-widest text-fg-subtle font-mono">
              Assign role
            </div>
            {ROLES.map((r) => (
              <DropdownMenuItem
                key={r}
                onSelect={() => setRole(r)}
                className={cn(r === user.role && 'text-accent')}
              >
                <span className="flex-1 capitalize">{r}</span>
                {r === user.role && (
                  <span className="text-2xs font-mono text-fg-subtle">current</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <ResetPasswordItem user={user} />
            <DropdownMenuItem
              onSelect={deactivate}
              className="text-sev-critical focus:text-sev-critical focus:bg-sev-critical/10"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

function ResetPasswordItem({ user }: { user: User }) {
  const [open, setOpen] = React.useState(false)
  const [pw, setPw] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (pw.length < 12) {
      toast.error('Password must be at least 12 characters')
      return
    }
    setBusy(true)
    try {
      await usersApi.resetPassword(user.id, pw)
      toast.success('Password reset', { description: user.email })
      setOpen(false)
      setPw('')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error('Could not reset password', { description: e.response?.data?.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <KeyRound className="h-3.5 w-3.5 text-fg-subtle" />
          Reset password
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-mono text-fg">{user.email}</span>. They will need to use it on their next sign-in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pw" hint="min 12 chars">
              New password
            </Label>
            <Input
              id="new-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              required
              minLength={12}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={busy} disabled={busy || pw.length < 12}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [role, setRole] = React.useState<User['role']>('operator')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await usersApi.create({ email: email.trim(), password, role })
      toast.success('User created', { description: email })
      setOpen(false)
      setEmail('')
      setPassword('')
      setRole('operator')
      onCreated()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setError(e.response?.data?.error ?? e.message ?? 'Could not create user.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm" leftIcon={<UserPlus />}>
          Invite operator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite operator</DialogTitle>
          <DialogDescription>
            Creates an account with the password you set. Share it over a secure channel.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {error && (
            <div className="flex items-start gap-2.5 rounded-md border border-sev-critical/30 bg-sev-critical/5 px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-sev-critical mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed text-sev-critical/90">{error}</div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-email" hint="required">Email</Label>
            <Input
              id="inv-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-pw" hint="min 12 chars">Initial password</Label>
            <Input
              id="inv-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-role">Role</Label>
            <select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as User['role'])}
              className="h-8 rounded-md border border-border bg-bg-muted px-3 text-sm text-fg focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/15"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={busy}
              disabled={busy || !email.trim() || password.length < 12}
            >
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
