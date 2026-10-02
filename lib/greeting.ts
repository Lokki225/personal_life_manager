import { createTranslator, m, type Translator } from './i18n/translate'

const MONTH_NOTES = [
  m('A new year, a clean slate for your budget.'),
  m('Short month: every day counts a little more.'),
  m('A quarter of the year is almost behind you.'),
  m('A good month to check your plan still fits.'),
  m('Steady days add up. Keep the rhythm.'),
  m('Halfway through the year already.'),
  m('Second half of the year: a fresh start.'),
  m('A quiet month to build your buffer.'),
  m('Back to routine, back to the plan.'),
  m('Last quarter of the year begins.'),
  m('The busy season is close. Plan ahead.'),
  m('Finish the year the way you want to start the next.'),
]

const english = createTranslator('en')

// A greeting that follows the time of day, and a short line that follows the
// month: its first days, its last days, or the month itself.
export function greetingFor(date: Date, t: Translator = english): { salutation: string; note: string } {
  const hour = date.getHours()
  const salutation = t(
    hour < 5 ? m('Still up') : hour < 12 ? m('Good morning') : hour < 18 ? m('Good afternoon') : m('Good evening'),
  )
  const month = new Intl.DateTimeFormat(t.intl, { month: 'long' }).format(date)

  const day = date.getDate()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const note =
    day <= 2
      ? // In a sentence of its own, the month starts with a capital in every language.
        t('{month} starts here. A fresh budget.', { month: month.charAt(0).toUpperCase() + month.slice(1) })
      : day >= lastDay - 2
        ? t('Last days of {month}. Finish it well.', { month })
        : t(MONTH_NOTES[date.getMonth()])

  return { salutation, note }
}

// A first name to greet with, taken from the start of the email address,
// since accounts have no name yet: "franklin.lokki@x.com" gives "Franklin".
export function displayNameFromEmail(email: string | null | undefined): string | null {
  const first = (email ?? '').split('@')[0].split(/[._+\-\d]/)[0]

  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null
}
