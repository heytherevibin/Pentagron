'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  SettingOutlined,
  LogoutOutlined,
  DashboardOutlined,
  ProjectOutlined,
  ApiOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import {
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_STORAGE_KEY,
} from '@/lib/sidebar-constants'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', href: '/', icon: DashboardOutlined },
      { label: 'Projects', href: '/projects/new', icon: ProjectOutlined },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'MCP Tools', href: '/settings?tab=mcp', icon: ApiOutlined },
      { label: 'LLM Agents', href: '/settings?tab=agents', icon: ExperimentOutlined },
    ],
  },
]

function getMatchingHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter(
    (h) => pathname === h || (h !== '/' && pathname.startsWith(h + '/'))
  )
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.length - a.length)[0]
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      setCollapsed(saved === 'true')
    } catch {
      // ignore
    }
  }, [])

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('pentagron_token')
      document.cookie =
        'pentagron_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
  const isSettingsActive = pathname.startsWith('/settings')

  const navLinkStyle = (
    active: boolean,
    collapsed: boolean
  ): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : undefined,
    gap: collapsed ? 0 : 10,
    padding: collapsed ? '8px' : '6px 10px',
    borderRadius: 0,
    fontSize: '13px',
    textDecoration: 'none',
    color: active ? 'var(--foreground)' : 'var(--muted)',
    backgroundColor: active ? 'var(--surface-2)' : 'transparent',
    fontWeight: active ? 500 : 400,
    transition: 'color 0.15s, background-color 0.15s',
    position: 'relative',
    marginBottom: '1px',
  })

  const activeBar = (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: '6px',
        bottom: '6px',
        width: '3px',
        borderRadius: 0,
        backgroundColor: '#2563eb',
      }}
    />
  )

  const dividerStyle: React.CSSProperties = {
    height: 1,
    backgroundColor: 'var(--border)',
    margin: collapsed ? '0 4px 6px' : '0 2px 8px',
  }

  return (
    <div
      onMouseEnter={() => setSidebarHovered(true)}
      onMouseLeave={() => setSidebarHovered(false)}
      style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50 }}
    >
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width,
          backgroundColor: 'var(--surface-1)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
          fontFamily: 'var(--font-mono), monospace',
          overflow: 'hidden',
          transition: 'width 0.25s ease-in-out',
        }}
      >
        {/* Brand — mi48: 24×24 logo, name, divider, pill, gear */}
        <div
          style={{
            padding: collapsed ? 12 : '16px 16px 12px',
            borderBottom: '1px solid var(--border)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : undefined,
              gap: collapsed ? 4 : 6,
              width: '100%',
            }}
          >
            <Link
              href="/"
              title={
                collapsed && sidebarHovered
                  ? 'Expand sidebar'
                  : !collapsed && sidebarHovered
                    ? 'Collapse sidebar'
                    : 'Home'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 8,
                textDecoration: 'none',
                flexShrink: 0,
              }}
              onClick={(e) => {
                if (!sidebarHovered) return
                e.preventDefault()
                const next = !collapsed
                setCollapsed(next)
                try {
                  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
                } catch {
                  // ignore
                }
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 0,
                  backgroundColor: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    fontSize: '10px',
                  }}
                >
                  P
                </span>
              </div>
              {!collapsed && (
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--foreground)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  PENTAGRON
                </span>
              )}
            </Link>
            {!collapsed && (
              <div
                style={{
                  width: 1,
                  height: 10,
                  backgroundColor: 'var(--border)',
                }}
              />
            )}
            {!collapsed && (
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--muted)',
                  padding: '1px 5px',
                  borderRadius: 0,
                  border: '1px solid var(--border)',
                }}
              >
                Pro
              </span>
            )}
            {!collapsed && <div style={{ flex: 1 }} />}
            {!collapsed && (
              <button
                type="button"
                onClick={() => router.push('/settings')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  lineHeight: 0,
                  flexShrink: 0,
                }}
                title="Settings"
              >
                <SettingOutlined
                  style={{
                    fontSize: 18,
                    color: isSettingsActive ? 'var(--accent)' : 'var(--muted)',
                    transition: 'color 0.15s',
                  }}
                />
              </button>
            )}
          </div>
        </div>

        {/* Main navigation — Operations + System only (per architecture plan) */}
        <div
          style={{
            padding: collapsed ? '8px 4px' : '8px 8px',
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {NAV_GROUPS.map((group, groupIndex) => {
            const hrefs = group.items.map((i) => i.href)
            return (
              <div key={group.label}>
                {groupIndex > 0 && <div style={dividerStyle} />}
                <div style={{ marginBottom: collapsed ? 4 : 12 }}>
                  {!collapsed && (
                    <div
                      style={{
                        padding: '16px 10px 6px',
                        fontSize: '9px',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        userSelect: 'none',
                      }}
                    >
                      {group.label}
                    </div>
                  )}
                  <div style={{ marginBottom: 1 }}>
                    {group.items.map((item) => {
                      const matching = getMatchingHref(pathname, hrefs)
                      const active =
                        item.href === '/'
                          ? pathname === '/'
                          : matching === item.href
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.label}
                          style={navLinkStyle(active, collapsed)}
                        >
                          <Icon
                            style={{
                              fontSize: 14,
                              color: active ? 'var(--accent)' : 'var(--muted)',
                              flexShrink: 0,
                            }}
                          />
                          {!collapsed && <span>{item.label}</span>}
                          {active && activeBar}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer — distinct block: Sign out + System Online */}
        <footer
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            minHeight: collapsed ? 72 : 88,
            padding: collapsed ? '10px 4px' : '10px 12px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--surface-2)',
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...navLinkStyle(false, collapsed),
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'var(--muted)',
              marginTop: 0,
              marginBottom: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f87171'
              e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <LogoutOutlined
              style={{ fontSize: 14, color: 'inherit', flexShrink: 0 }}
            />
            {!collapsed && <span>Sign out</span>}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0 0',
              marginTop: 8,
              borderTop: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
              }}
            />
            {!collapsed && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                System Online
              </span>
            )}
          </div>
        </footer>
      </aside>
    </div>
  )
}
