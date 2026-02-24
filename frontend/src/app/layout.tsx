import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pentagron — Autonomous AI Pentesting',
  description: 'Fully automated AI penetration testing framework',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-pentagron-bg text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
