'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { DEFAULT_LOCALE, type Locale } from './config'
import { createTranslator, type Translator } from './translate'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

// The translator for client components.
export function useT(): Translator {
  const locale = useContext(LocaleContext)

  return useMemo(() => createTranslator(locale), [locale])
}
