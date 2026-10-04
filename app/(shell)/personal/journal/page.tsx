import Link from 'next/link'
import { redirect } from 'next/navigation'
import { NotebookPen } from 'lucide-react'

import { linkOptions, listEntries } from '@/application/personal/journal'
import { JOURNAL_TYPES, type JournalType } from '@/domain/personal/journal'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { NewEntryDrawer } from './entry-forms'
import { ENTRY_TYPE_LABELS } from './entry-labels'
import { EntryCard } from './entry-view'

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default async function PersonalJournalPage({ searchParams }: PageProps<'/personal/journal'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  // The filter lives in the address, so the switcher reopens on it.
  const type = JOURNAL_TYPES.find((value) => value === params.type) ?? null
  const [entries, links] = await Promise.all([listEntries(user.id, type), linkOptions(user.id)])
  const now = clockNow()
  const dayFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  const thisWeek = entries.filter((e) => e.entryDate >= weekAgo).length

  // Entries grouped by their day, newest first.
  const days = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = isoDay(entry.entryDate)
    days.set(key, [...(days.get(key) ?? []), entry])
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Journal')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.plural(thisWeek, '{count} entry this week.', '{count} entries this week.')}
          </p>
        </div>
        <NewEntryDrawer links={links} today={isoDay(now)} />
      </header>

      <nav aria-label={t('Filter entries')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {([null, ...JOURNAL_TYPES] as (JournalType | null)[]).map((value) => (
          <Link
            key={value ?? 'all'}
            href={value ? `/personal/journal?type=${value}` : '/personal/journal'}
            aria-current={type === value ? 'page' : undefined}
            className={cn(
              'flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
              type === value ? 'border-node-accent bg-node-accent text-on-node-accent' : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {value ? t(ENTRY_TYPE_LABELS[value]) : t('All')}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <NotebookPen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{type ? t('No entries of this kind yet') : t('Your journal is empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('A line about your day, a decision and why, an idea: it becomes the story behind your goals.')}
          </p>
        </div>
      ) : (
        [...days.entries()].map(([key, dayEntries]) => (
          <section key={key} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground first-letter:uppercase">
              {dayFormatter.format(dayEntries[0].entryDate)}
            </h2>
            <ul className="space-y-2">
              {dayEntries.map((entry) => (
                <li key={entry.id}>
                  <EntryCard entry={entry} t={t} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}
