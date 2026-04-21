import {
  LayoutDashboard,
  FolderKanban,
  Workflow,
  Network,
  ShieldCheck,
  Settings,
  Activity,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Pathname prefix used for active-state matching. */
  match?: (pathname: string) => boolean
  /** Optional keyboard shortcut hint shown in the command palette. */
  shortcut?: string
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      {
        href: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        match: (p) => p === '/',
        shortcut: 'G D',
      },
      {
        href: '/projects',
        label: 'Projects',
        icon: FolderKanban,
        match: (p) => p.startsWith('/projects'),
        shortcut: 'G P',
      },
      {
        href: '/flows',
        label: 'Flows',
        icon: Workflow,
        match: (p) => p.startsWith('/flows'),
        shortcut: 'G F',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        href: '/evograph',
        label: 'EvoGraph',
        icon: Network,
        match: (p) => p.startsWith('/evograph'),
        shortcut: 'G E',
      },
      {
        href: '/activity',
        label: 'Activity',
        icon: Activity,
        match: (p) => p.startsWith('/activity'),
        shortcut: 'G A',
      },
    ],
  },
  {
    label: 'Control',
    items: [
      {
        href: '/approvals',
        label: 'Approvals',
        icon: ShieldCheck,
        match: (p) => p.startsWith('/approvals'),
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        match: (p) => p.startsWith('/settings'),
        shortcut: 'G S',
      },
    ],
  },
]

/** Flattened list — useful for command palette search. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)
