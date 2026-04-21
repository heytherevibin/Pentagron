'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Workflow,
  Network,
  ShieldCheck,
  Settings,
  Activity,
  Plus,
  LogOut,
  Moon,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { auth } from '@/lib/api'

/* ════════════════════════════════════════════════════════════════════════════
   Context — consumed by the shell to open the palette from anywhere
   ════════════════════════════════════════════════════════════════════════════ */

type PaletteCtx = {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const Ctx = React.createContext<PaletteCtx | null>(null)

export function useCommandPalette() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>')
  return ctx
}

/* ════════════════════════════════════════════════════════════════════════════
   Provider — wraps the authenticated tree, installs ⌘K / Ctrl-K listener
   ════════════════════════════════════════════════════════════════════════════ */

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((v) => !v), [])

  // Global ⌘K / Ctrl-K shortcut.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <Ctx.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Palette UI
   ════════════════════════════════════════════════════════════════════════════ */

type Action = {
  id: string
  label: string
  icon: LucideIcon
  shortcut?: string
  run: (router: ReturnType<typeof useRouter>) => void | Promise<void>
  keywords?: string[]
}

const NAVIGATE: Action[] = [
  { id: 'nav-dash', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', run: (r) => r.push('/'), keywords: ['home', 'overview'] },
  { id: 'nav-proj', label: 'Go to Projects', icon: FolderKanban, shortcut: 'G P', run: (r) => r.push('/projects') },
  { id: 'nav-flows', label: 'Go to Flows', icon: Workflow, shortcut: 'G F', run: (r) => r.push('/flows') },
  { id: 'nav-evo', label: 'Open EvoGraph', icon: Network, shortcut: 'G E', run: (r) => r.push('/evograph'), keywords: ['graph', 'attack chain'] },
  { id: 'nav-act', label: 'Open Activity', icon: Activity, shortcut: 'G A', run: (r) => r.push('/activity') },
  { id: 'nav-app', label: 'Open Approvals', icon: ShieldCheck, run: (r) => r.push('/approvals') },
  { id: 'nav-set', label: 'Open Settings', icon: Settings, shortcut: 'G S', run: (r) => r.push('/settings') },
]

const CREATE: Action[] = [
  { id: 'create-proj', label: 'New project', icon: Plus, shortcut: 'N P', run: (r) => r.push('/projects/new') },
  { id: 'create-flow', label: 'New flow', icon: Plus, shortcut: 'N F', run: (r) => r.push('/flows?new=1') },
]

const SYSTEM: Action[] = [
  {
    id: 'sys-docs',
    label: 'Open documentation',
    icon: FileText,
    run: () => {
      window.open('https://github.com/heytherevibin/Pentagron', '_blank')
    },
    keywords: ['help', 'github'],
  },
  {
    id: 'sys-theme',
    label: 'Theme · dark (locked)',
    icon: Moon,
    run: () => {
      toast.info('Light theme not yet available')
    },
  },
  {
    id: 'sys-logout',
    label: 'Sign out',
    icon: LogOut,
    run: async (r) => {
      await auth.logout().catch(() => undefined)
      localStorage.removeItem('pentagron_token')
      sessionStorage.removeItem('pentagron_token')
      document.cookie = 'pentagron_token=; path=/; max-age=0; samesite=lax'
      r.replace('/login')
    },
    keywords: ['logout', 'quit'],
  },
]

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()

  const runAction = React.useCallback(
    (action: Action) => {
      onOpenChange(false)
      // Let the dialog close before navigating to avoid focus-trap flicker.
      requestAnimationFrame(() => {
        void action.run(router)
      })
    },
    [onOpenChange, router],
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} placeholder="Search commands, projects, flows…">
      <Section heading="Navigate" actions={NAVIGATE} onRun={runAction} />
      <CommandSeparator />
      <Section heading="Create" actions={CREATE} onRun={runAction} />
      <CommandSeparator />
      <Section heading="System" actions={SYSTEM} onRun={runAction} />
    </CommandDialog>
  )
}

function Section({
  heading,
  actions,
  onRun,
}: {
  heading: string
  actions: Action[]
  onRun: (a: Action) => void
}) {
  return (
    <CommandGroup heading={heading}>
      {actions.map((a) => (
        <CommandItem
          key={a.id}
          value={`${a.label} ${a.keywords?.join(' ') ?? ''}`}
          onSelect={() => onRun(a)}
        >
          <a.icon className="h-3.5 w-3.5 text-fg-subtle" />
          <span>{a.label}</span>
          {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
