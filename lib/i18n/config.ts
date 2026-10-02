export const LOCALES = ['en', 'fr'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'locale'

// The tag used for dates and numbers.
export const INTL_LOCALES: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' }

const isLocale = (value: string | undefined | null): value is Locale => LOCALES.includes(value as Locale)

// The language to show: the one the person chose, else the first language of
// their browser that the app speaks, else English.
export function pickLocale(chosen: string | undefined | null, acceptLanguage: string | undefined | null): Locale {
  if (isLocale(chosen)) {
    return chosen
  }

  for (const entry of (acceptLanguage ?? '').split(',')) {
    const language = entry.split(';')[0].trim().slice(0, 2).toLowerCase()

    if (isLocale(language)) {
      return language
    }
  }

  return DEFAULT_LOCALE
}
