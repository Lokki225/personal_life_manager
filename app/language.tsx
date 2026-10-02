'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/config'
import { useT } from '@/lib/i18n/client'

// Remembers the chosen language for a year and shows the page again in it.
export function useSetLocale() {
  const router = useRouter()

  return (locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }
}

// The round button beside the theme toggle on pages open to visitors. It
// shows the language it switches to.
export function LanguageCornerButton() {
  const t = useT()
  const setLocale = useSetLocale()
  const next: Locale = t.locale === 'fr' ? 'en' : 'fr'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setLocale(next)}
      className="absolute right-[4.25rem] top-4 z-50 size-11 rounded-full bg-card text-xs font-semibold shadow-[var(--shadow-soft)]"
      aria-label={next === 'fr' ? 'Passer en français' : 'Switch to English'}
      lang={next}
    >
      {next.toUpperCase()}
    </Button>
  )
}
