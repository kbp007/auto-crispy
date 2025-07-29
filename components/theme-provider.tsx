"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

const DynamicThemeProvider = dynamic(
  () => Promise.resolve(NextThemesProvider),
  { ssr: false }
)

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <DynamicThemeProvider {...props}>
      {children}
    </DynamicThemeProvider>
  )
} 