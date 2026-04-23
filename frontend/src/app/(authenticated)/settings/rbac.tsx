'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Check, Minus, Plus, Shield } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SettingsCard } from './settings-card'
import { rbac as rbacApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { RbacPermission, RbacRole } from '@/types'

const DEFAULT_PERMISSIONS: RbacPermission[] = [
  { key: 'projects:read',  group: 'Projects',  description: 'View project list and details' },
  { key: 'projects:write', group: 'Projects',  description: 'Create, edit, and delete projects' },
  { key: 'flows:read',     group: 'Flows',     description: 'View flow timeline, findings, and graph' },
  { key: 'flows:write',    group: 'Flows',     description: 'Launch, cancel, and delete flows' },
  { key: 'approvals:grant',group: 'Approvals', description: 'Approve / reject phase-gated requests' },
  { key: 'findings:read',  group: 'Findings',  description: 'View findings and artifacts' },
  { key: 'findings:export',group: 'Findings',  description: 'Download reports and export data' },
  { key: 'settings:read',  group: 'Settings',  description: 'View workspace settings' },
  { key: 'settings:write', group: 'Settings',  description: 'Modify workspace settings' },
  { key: 'users:manage',   group: 'Users',     description: 'Invite, deactivate, reset passwords' },
  { key: 'audit:read',     group: 'Security',  description: 'View the audit log' },
  { key: 'keys:manage',    group: 'Security',  description: 'Create / revoke API keys' },
]

/**
 * RbacSettings — visual permission matrix. Shows every role as a column and
 * every permission as a row, with clickable cells that grant / revoke. System
 * roles (admin, operator, viewer) are read-only.
 */
export function RbacSettings() {
  const { data: rolesData, isLoading: rolesLoading, mutate: mutateRoles } = useSWR<RbacRole[]>(
    '/api/rbac/roles',
    async () => {
      try {
        const r = await rbacApi.roles()
        const d = r.data as { roles?: RbacRole[] } | RbacRole[]
        return Array.isArray(d) ? d : (d.roles ?? [])
      } catch {
        return DEFAULT_SYSTEM_ROLES
      }
    },
  )

  const { data: permsData } = useSWR<RbacPermission[]>(
    '/api/rbac/permissions',
    async () => {
      try {
        const r = await rbacApi.permissions()
        const d = r.data as { permissions?: RbacPermission[] } | RbacPermission[]
        const arr = Array.isArray(d) ? d : (d.permissions ?? [])
        return arr.length > 0 ? arr : DEFAULT_PERMISSIONS
      } catch {
        return DEFAULT_PERMISSIONS
      }
    },
  )

  const roles = rolesData ?? []
  const permissions = permsData ?? DEFAULT_PERMISSIONS

  const groups = React.useMemo(() => {
    const by = new Map<string, RbacPermission[]>()
    for (const p of permissions) {
      const arr = by.get(p.group) ?? []
      arr.push(p)
      by.set(p.group, arr)
    }
    return [...by.entries()]
  }, [permissions])

  const [editing, setEditing] = React.useState<RbacRole | null>(null)
  const [creating, setCreating] = React.useState(false)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this role? Users assigned to it fall back to "viewer".')) return
    try {
      await rbacApi.deleteRole(id)
      toast.success('Role deleted')
      void mutateRoles()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <>
      <SettingsCard
        title="Roles & permissions"
        description="Fine-grained role-based access control. System roles ship preconfigured and can't be edited; clone one to make your own."
        footer={
          <div className="flex items-center justify-end">
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              New role
            </Button>
          </div>
        }
      >
        {/* Role header strip */}
        <div className="mb-3 flex flex-wrap gap-2">
          {rolesLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-7 w-24 rounded-full skeleton" />
              ))
            : roles.map((r) => (
                <Card
                  key={r.id}
                  className={cn(
                    'border',
                    r.system ? 'border-border-subtle' : 'border-accent/40 bg-accent/5',
                  )}
                >
                  <CardContent className="flex items-center gap-2 px-3 py-1.5">
                    <Shield className="h-3.5 w-3.5 text-fg-subtle" />
                    <div>
                      <div className="text-xs font-medium text-fg">{r.name}</div>
                      <div className="meta-mono mt-0.5">
                        {r.permissions.length} perms · {r.system ? 'system' : 'custom'}
                      </div>
                    </div>
                    {!r.system && (
                      <div className="flex items-center gap-0.5 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-2xs"
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-2xs text-sev-critical hover:text-sev-critical"
                          onClick={() => handleDelete(r.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Permission matrix */}
        <div className="rounded-lg border border-border overflow-hidden">
          <ScrollArea className="max-h-[60vh]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-bg-muted/90 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-2xs font-mono uppercase tracking-widest text-fg-subtle">
                    Permission
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r.id}
                      className="px-2 py-2 text-center text-2xs font-mono uppercase tracking-wider text-fg-subtle min-w-[72px]"
                    >
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, perms]) => (
                  <React.Fragment key={group}>
                    <tr>
                      <td
                        colSpan={roles.length + 1}
                        className="bg-bg-subtle/60 px-3 py-1 text-2xs font-mono uppercase tracking-widest text-fg-muted"
                      >
                        {group}
                      </td>
                    </tr>
                    {perms.map((p) => (
                      <tr
                        key={p.key}
                        className="border-b border-border-subtle/60 last:border-0 hover:bg-bg-muted/40"
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="text-xs text-fg font-mono">{p.key}</div>
                          <div className="meta-mono mt-0.5 normal-case tracking-normal">
                            {p.description}
                          </div>
                        </td>
                        {roles.map((r) => {
                          const has = r.permissions.includes(p.key)
                          return (
                            <td key={r.id} className="px-2 py-2 text-center">
                              {has ? (
                                <Check className="inline h-3.5 w-3.5 text-accent" strokeWidth={3} />
                              ) : (
                                <Minus className="inline h-3 w-3 text-fg-disabled" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </SettingsCard>

      <RoleEditorDialog
        open={creating || editing !== null}
        role={editing}
        permissions={permissions}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={() => {
          setCreating(false)
          setEditing(null)
          void mutateRoles()
        }}
      />
    </>
  )
}

function RoleEditorDialog({
  open,
  role,
  permissions,
  onClose,
  onSaved,
}: {
  open: boolean
  role: RbacRole | null
  permissions: RbacPermission[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [granted, setGranted] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setGranted(new Set(role?.permissions ?? []))
  }, [role])

  const togglePerm = (k: string) => {
    setGranted((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      if (role) {
        await rbacApi.updateRole(role.id, {
          name: name.trim(),
          description: description.trim(),
          permissions: [...granted],
        })
      } else {
        await rbacApi.createRole({
          name: name.trim(),
          description: description.trim(),
          permissions: [...granted],
        })
      }
      toast.success(role ? 'Role updated' : 'Role created')
      onSaved()
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : 'New role'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="auditor"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="role-desc">Description</Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Read-only access for compliance reviewers"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Permissions ({granted.size}/{permissions.length})</Label>
            <ScrollArea className="mt-1.5 h-52 rounded-md border border-border bg-bg-muted/50 p-2">
              <div className="flex flex-col gap-1.5">
                {permissions.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated cursor-pointer"
                  >
                    <Checkbox
                      checked={granted.has(p.key)}
                      onCheckedChange={() => togglePerm(p.key)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-fg">{p.key}</div>
                      <div className="meta-mono mt-0.5 normal-case tracking-normal">
                        {p.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───── fallback data when backend is offline ───── */

const DEFAULT_SYSTEM_ROLES: RbacRole[] = [
  {
    id: 'sys-admin',
    name: 'admin',
    description: 'Full workspace control',
    permissions: DEFAULT_PERMISSIONS.map((p) => p.key),
    system: true,
  },
  {
    id: 'sys-operator',
    name: 'operator',
    description: 'Launch and operate flows; cannot manage users',
    permissions: [
      'projects:read', 'projects:write',
      'flows:read', 'flows:write',
      'approvals:grant',
      'findings:read', 'findings:export',
      'settings:read',
    ],
    system: true,
  },
  {
    id: 'sys-viewer',
    name: 'viewer',
    description: 'Read-only access to everything',
    permissions: [
      'projects:read', 'flows:read', 'findings:read', 'findings:export', 'settings:read', 'audit:read',
    ],
    system: true,
  },
]

// Suppress unused — used by <Badge> when we eventually colourize system vs custom.
void Badge
