import { cache } from 'react'
import { cookies, headers } from 'next/headers'

import { LOCALE_COOKIE, pickLocale, type Locale } from './config'
import { createTranslator, type Translator } from './translate'

export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()])

  return pickLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get('accept-language'))
})

// The translator for the current request, for server components and actions.
export const getT = cache(async (): Promise<Translator> => createTranslator(await getLocale()))
