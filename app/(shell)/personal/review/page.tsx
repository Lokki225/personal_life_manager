import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { linkOptions } from '@/application/personal/journal'
import { getWeeklyReview } from '@/application/personal/review'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { SaveSnapshot } from '@/components/offline/save-snapshot'
import { isoDay } from '@/lib/offline/snapshots'

import { NewEntryDrawer } from '../journal/entry-forms'
import { EntryCard } from '../journal/entry-view'
import { CARRY_REASON_LABELS } from '../tasks/task-forms'

const parseDay = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

export default async function PersonalReviewPage({ searchParams }: PageProps<'/personal/review'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const now = clockNow()
  // The week lives in the address, so the switcher reopens on it.
  const asked = parseDay(params.week)
  const day = asked && asked <= now ? asked : now
  const [{ start, end, review, reviewEntry }, links] = await Promise.all([getWeeklyReview(user.id, day, now), linkOptions(user.id)])

  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
  const range = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long' })
  const previous = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)
  const isCurrent = end > now
  const hours = (minutes: number) => new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(minutes / 60)
  const reasonLabel = (reason: string) => (reason === 'none' ? t('No reason given') : t(CARRY_REASON_LABELS[reason] ?? reason))

  // A starting point for the written review, with this week's numbers.
  const prompt = [
    t('Tasks done: {done}. Days slipped: {slips}.', { done: review.tasksDone, slips: review.slips }),
    review.topReason ? t('Most common reason: {reason}.', { reason: reasonLabel(review.topReason) }) : null,
    t('Time in sessions: {hours} h.', { hours: hours(review.sessions.minutes) }),
    '',
    t('What went well?'),
    '',
    t('What got in the way?'),
    '',
    t('What will I change next week?'),
    '',
  ]
    .filter((line) => line !== null)
    .join('\n')

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      {isCurrent ? (
        <SaveSnapshot
          snapshotKey="personal.review"
          data={{
            start: isoDay(start),
            end: isoDay(lastDay),
            tasksDone: review.tasksDone,
            slips: review.slips,
            reasons: review.reasons,
            sessionMinutes: review.sessions.minutes,
            byGoal: review.sessions.byGoal,
            onTrack: review.goals.onTrack.map((g) => g.name),
            behind: review.goals.behind.map((g) => g.name),
            achieved: review.goals.achieved.map((g) => g.name),
            habitsKept: review.goals.habitsKept.map((g) => g.name),
            habitsSlipping: review.goals.habitsSlipping.map((g) => g.name),
          }}
        />
      ) : null}
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Review')}</h1>
        <nav aria-label={t('Weeks')} className="flex items-center justify-between gap-2">
          <Link
            href={`/personal/review?week=${isoDay(previous)}`}
            className="flex size-11 items-center justify-center rounded-full border bg-card hover:border-node-accent/50"
            aria-label={t('Previous week')}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <p className="text-center text-sm font-medium">
            {isCurrent ? t('This week') : t('Week of {start} to {end}', { start: range.format(start), end: range.format(lastDay) })}
            {isCurrent ? <span className="block text-xs font-normal text-muted-foreground">{t('{start} to {end}', { start: range.format(start), end: range.format(lastDay) })}</span> : null}
          </p>
          {isCurrent ? (
            <span className="size-11" />
          ) : (
            <Link
              href={`/personal/review?week=${isoDay(end)}`}
              className="flex size-11 items-center justify-center rounded-full border bg-card hover:border-node-accent/50"
              aria-label={t('Next week')}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </Link>
          )}
        </nav>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('Tasks done'), value: String(review.tasksDone) },
          { label: t('Days slipped'), value: String(review.slips) },
          { label: t('Hours in sessions'), value: hours(review.sessions.minutes) },
        ].map((tile) => (
          <Card key={tile.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section aria-labelledby="slips-title" className="space-y-2">
        <h2 id="slips-title" className="font-semibold">
          {t('Why tasks slipped')}
        </h2>
        {review.reasons.length > 0 ? (
          <ul className="space-y-1.5">
            {review.reasons.map(({ reason, count }) => (
              <li key={reason} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0">{reasonLabel(reason)}</span>
                <span className="h-2 rounded-full bg-node-accent" style={{ width: `${Math.max((count / review.slips) * 100, 4)}%` }} />
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('Nothing slipped this week.')}</p>
        )}
        {review.stillRelevant.length > 0 ? (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
            <p className="font-medium">{t('Still relevant?')}</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {review.stillRelevant.map((task) => (
                <li key={task.id}>
                  {task.title} · {t.plural(task.carryCount, 'Carried over {count} time', 'Carried over {count} times')}
                </li>
              ))}
            </ul>
            <Link href="/personal/tasks?filter=carried" className="mt-1 inline-block font-medium text-node-accent hover:underline">
              {t('Decide in Tasks')}
            </Link>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="goals-title" className="space-y-2">
        <h2 id="goals-title" className="font-semibold">
          {t('Goals')}
        </h2>
        {review.goals.total > 0 ? (
          <ul className="space-y-1 text-sm">
            {[
              { label: t('On track'), goals: review.goals.onTrack },
              { label: t('Behind'), goals: review.goals.behind },
              { label: t('Achieved'), goals: review.goals.achieved },
              { label: t('Habits kept'), goals: review.goals.habitsKept },
              { label: t('Habits slipping'), goals: review.goals.habitsSlipping },
            ]
              .filter((row) => row.goals.length > 0)
              .map((row) => (
                <li key={row.label}>
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {row.goals.map((g, index) => (
                      <span key={g.id}>
                        {index > 0 ? ', ' : ''}
                        <Link href={`/personal/goals/${g.id}`} className="hover:underline">
                          {g.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('No goals yet.')}</p>
        )}
        <p className="text-xs text-muted-foreground">{t('Goals show where they stand today.')}</p>
      </section>

      <section aria-labelledby="time-title" className="space-y-2">
        <h2 id="time-title" className="font-semibold">
          {t('Where the time went')}
        </h2>
        {review.sessions.byGoal.length > 0 ? (
          <ul className="divide-y rounded-xl border bg-card">
            {review.sessions.byGoal.map(({ goal, minutes }) => (
              <li key={goal ?? 'none'} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span>{goal ?? t('Without a goal')}</span>
                <span className="tabular-nums text-muted-foreground">{t('{hours} h', { hours: hours(minutes) })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('No sessions this week.')}</p>
        )}
      </section>

      <section aria-labelledby="reflection-title" className="space-y-2 border-t pt-4">
        <h2 id="reflection-title" className="font-semibold">
          {t('Your reflection')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.plural(review.entries, '{count} journal entry this week.', '{count} journal entries this week.')}
        </p>
        {reviewEntry ? (
          <EntryCard entry={reviewEntry} t={t} />
        ) : (
          <NewEntryDrawer links={links} today={isoDay(isCurrent ? now : lastDay)} label={t('Write this week’s review')} initialBody={prompt} initialType="REVIEW" />
        )}
      </section>
    </main>
  )
}
