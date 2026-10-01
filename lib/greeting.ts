const MONTH_NOTES = [
  'A new year, a clean slate for your budget.',
  'Short month: every day counts a little more.',
  'A quarter of the year is almost behind you.',
  'A good month to check your plan still fits.',
  'Steady days add up. Keep the rhythm.',
  'Halfway through the year already.',
  'Second half of the year: a fresh start.',
  'A quiet month to build your buffer.',
  'Back to routine, back to the plan.',
  'Last quarter of the year begins.',
  'The busy season is close. Plan ahead.',
  'Finish the year the way you want to start the next.',
]

const monthName = (date: Date) => new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date)

// A greeting that follows the time of day, and a short line that follows the
// month: its first days, its last days, or the month itself.
export function greetingFor(date: Date): { salutation: string; note: string } {
  const hour = date.getHours()
  const salutation =
    hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const day = date.getDate()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const note =
    day <= 2
      ? `${monthName(date)} starts here. A fresh budget.`
      : day >= lastDay - 2
        ? `Last days of ${monthName(date)}. Finish it well.`
        : MONTH_NOTES[date.getMonth()]

  return { salutation, note }
}

// A first name to greet with, taken from the start of the email address,
// since accounts have no name yet: "franklin.lokki@x.com" gives "Franklin".
export function displayNameFromEmail(email: string | null | undefined): string | null {
  const first = (email ?? '').split('@')[0].split(/[._+\-\d]/)[0]

  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null
}
