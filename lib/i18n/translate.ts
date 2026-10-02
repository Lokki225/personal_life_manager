import { INTL_LOCALES, type Locale } from './config'
import { FR } from './fr'

export type MessageParams = Record<string, string | number>

// The English text is the key. `exact` maps it to the other language, with the
// same {placeholders}. `patterns` covers text that arrives already filled in
// (a rule message naming a chest, a note stored in the database): a regular
// expression and its translation, where {1}, {2}... are the captured parts.
export type Messages = {
  exact: Record<string, string>
  patterns: [pattern: string, translation: string][]
}

const MESSAGES: Record<Locale, Messages | null> = { en: null, fr: FR }

// An amount as English text writes it, e.g. "40,000".
const ENGLISH_AMOUNT = /^\d{1,3}(,\d{3})+$/

export type Translator = {
  (text: string, params?: MessageParams): string
  locale: Locale
  // The tag for Intl date and number formats, e.g. "fr-FR".
  intl: string
  // A whole amount, grouped the way the language writes it.
  amount: (value: number) => string
  // Picks the singular or plural wording for a count, then translates it.
  // The count is available to both as {count}.
  plural: (count: number, one: string, other: string, params?: MessageParams) => string
}

// Marks a text for translation where it is declared (a list of options, a
// table of labels) and translated later with `t(text)`.
export const m = (text: string) => text

export function createTranslator(locale: Locale): Translator {
  const messages = MESSAGES[locale]
  const intl = INTL_LOCALES[locale]
  // English keeps its long-standing "60,000" grouping.
  const numberFormatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : intl, { maximumFractionDigits: 0 })
  const amount = (value: number) => numberFormatter.format(Number.isFinite(value) ? value : 0)

  const lookup = (text: string): string => {
    if (!messages) {
      return text
    }

    const exact = messages.exact[text]

    if (exact !== undefined) {
      return exact
    }

    if (ENGLISH_AMOUNT.test(text)) {
      return amount(Number(text.replace(/,/g, '')))
    }

    for (const [pattern, translation] of messages.patterns) {
      const match = new RegExp(pattern).exec(text)

      if (match) {
        // Captured parts can be terms of their own: a built-in chest name, an amount.
        return translation.replace(/\{(\d+)\}/g, (_, index) => lookup(match[Number(index)] ?? ''))
      }
    }

    return text
  }

  const translate = (text: string, params?: MessageParams) => {
    const template = lookup(text)

    if (!params) {
      return template
    }

    return template.replace(/\{(\w+)\}/g, (placeholder, name) => {
      const value = params[name]

      if (value === undefined) {
        return placeholder
      }

      return typeof value === 'number' ? amount(value) : lookup(value)
    })
  }

  return Object.assign(translate, {
    locale,
    intl,
    amount,
    plural: (count: number, one: string, other: string, params?: MessageParams) =>
      // French counts zero as singular; English does not.
      translate((locale === 'fr' ? count < 2 : count === 1) ? one : other, { count, ...params }),
  })
}
