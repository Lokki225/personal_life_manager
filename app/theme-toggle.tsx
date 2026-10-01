'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark'

// The theme lives on <html data-theme>, set before paint by the inline script
// in app/layout.tsx. This component only reads and flips that attribute.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

const getTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
const getServerTheme = () => null

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, getServerTheme)
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'

  const toggleTheme = () => {
    document.documentElement.dataset.theme = nextTheme
    try {
      window.localStorage.setItem('theme', nextTheme)
    } catch {
      // Keep the selected theme for this page view when storage is unavailable.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="absolute right-4 top-4 z-50 size-11 rounded-full bg-card shadow-[var(--shadow-soft)]"
      aria-label={theme ? `Switch to ${nextTheme} theme` : 'Toggle color theme'}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" /> : theme === 'light' ? <Moon aria-hidden="true" /> : null}
    </Button>
  )
}
