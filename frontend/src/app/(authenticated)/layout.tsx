'use client'

import { useEffect } from 'react'
import { TopNav } from '@/components/ui/TopNav'
import { CommandPalette } from '@/components/ui/CommandPalette'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  /* Request browser notification permission once on first authenticated load */
  useEffect(() => {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission()
    }
  }, [])

  return (
    <>
      <TopNav />
      <CommandPalette />
      <main className="pt-12">{children}</main>
    </>
  )
}
