'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { CommandPalette } from '@/components/ui/CommandPalette'
import {
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_STORAGE_KEY,
} from '@/lib/sidebar-constants'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH_EXPANDED)

  useEffect(() => {
    function syncWidth() {
      const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
      setSidebarWidth(collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED)
    }
    syncWidth()
    const interval = setInterval(syncWidth, 200)
    return () => clearInterval(interval)
  }, [])

  // Notification permission must be requested from a user gesture.
  // We defer it until the user's first click anywhere in the app.
  useEffect(() => {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'default'
    ) {
      return
    }
    function requestOnGesture() {
      Notification.requestPermission()
      document.removeEventListener('click', requestOnGesture)
    }
    document.addEventListener('click', requestOnGesture)
    return () => document.removeEventListener('click', requestOnGesture)
  }, [])

  return (
    <>
      <Sidebar />
      <CommandPalette />
      <main
        className="min-h-screen min-w-0"
        style={{ marginLeft: sidebarWidth, transition: 'margin-left 0.25s ease-in-out' }}
      >
        {children}
      </main>
    </>
  )
}
