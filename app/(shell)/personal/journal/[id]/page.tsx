import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'

import { getEntry, linkOptions } from '@/application/personal/journal'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { DeleteEntryButton, EditEntryDrawer, LockSettings, UnlockForm } from '../entry-forms'
import { ENTRY_TYPE_LABELS } from '../entry-labels'
import { EntryBody } from '../entry-view'
import { unlockedChecker } from '../unlock'

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default async function JournalEntryPage({ params }: PageProps<'/personal/journal/[id]'>) {
  const [user, t, { id }] = await Promise.all([getSignedInUser(), getT(), params])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const entry = await getEntry(user.id, id, await unlockedChecker(user.id))

  if (!entry) {
    notFound()
  }

  const dateFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const scale = (label: string, value: number | null) => (value ? `${t(label)} ${value}/5` : null)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <Link href="/personal/journal" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('Journal')}
      </Link>

      <header className="space-y-1">
        <p className="text-sm font-medium text-node-accent">{t(ENTRY_TYPE_LABELS[entry.type])}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {entry.locked ? t('Locked entry') : (entry.title ?? dateFormatter.format(entry.entryDate))}
        </h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {[
            dateFormatter.format(entry.entryDate),
            scale('Mood', entry.mood),
            scale('Energy', entry.energy),
            entry.reviewOn ? t('look again on {date}', { date: dateFormatter.format(entry.reviewOn) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {entry.locked ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 font-medium">
            <Lock className="size-4 text-node-accent" aria-hidden="true" />
            {t('This entry is locked.')}
          </p>
          <p className="text-sm text-muted-foreground">{t('Enter its password to read it. It stays open for 15 minutes.')}</p>
          <UnlockForm entryId={entry.id} />
        </section>
      ) : (
        <>
          <article className="rounded-xl border bg-card p-4">
            <EntryBody body={entry.body!} />
          </article>

          <div className="flex flex-wrap items-start gap-2">
            <EditEntryDrawer
              draft={{
                id: entry.id,
                type: entry.type,
                title: entry.title,
                body: entry.body!,
                mood: entry.mood,
                energy: entry.energy,
                entryDate: isoDay(entry.entryDate),
                reviewOn: entry.reviewOn ? isoDay(entry.reviewOn) : null,
              }}
              links={await linkOptions(user.id)}
              today={isoDay(clockNow())}
            />
            <DeleteEntryButton entryId={entry.id} />
          </div>

          <LockSettings entryId={entry.id} isSecured={entry.isSecured} />
        </>
      )}
    </main>
  )
}
