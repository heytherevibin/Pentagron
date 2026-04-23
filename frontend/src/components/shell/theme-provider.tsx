'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

/**
 * ThemeProvider — thin wrapper over next-themes.
 *
 * We key the theme off `data-theme` (not `class`) so our palette in
 * globals.css can target `html[data-theme='light']` without colliding
 * with Tailwind's `dark:` class-based variants (we don't use them —
 * tokens handle both palettes through CSS variables).
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
