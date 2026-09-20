'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('theme') as 'light' | 'dark' | null
    const nextTheme =
      saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [mounted, theme])

  return (
    <button
      type="button"
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--text)] shadow-[var(--shadow-soft)] backdrop-blur-md transition hover:scale-[1.02]"
      aria-label="Toggle color theme"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span>{mounted ? (theme === 'dark' ? 'Light' : 'Dark') : 'Theme'}</span>
    </button>
  )
}
