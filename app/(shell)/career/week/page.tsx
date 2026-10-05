import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarClock } from 'lucide-react'

import { getRunway } from '@/application/career/money'
import { getWeek } from '@/application/career/week'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { MAX_FOCUS } from '@/domain/career/week'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { EntryBody } from '../../personal/journal/entry-view'
import { AddFocusDrawer, BringButton, CarryButton, FocusRow, QuickLog } from './week-forms'

export const metadata: Metadata = {
  title: 'Career week | Personal Life Manager',
}

export default async function CareerWeekPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [week, runway] = await Promise.all([getWeek(user.id, clockNow()), getRunway(user.id, clockNow())])
  const date = new Intl.DateTimeFormat(t.intl, { weekday: 'short', day: 'numeric', month: 'short' })
  const goals = week.goals
  const opportunities = week.opportunities.map((o) => ({ id: o.id, name: o.title }))
  const open = week.focus.filter((f) => f.status !== 'DONE').length

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Week')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('Week of {date}', { date: date.format(week.start) })}</p>
      </header>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold">
            {t('Focus')} <span className="font-normal text-muted-foreground">{t('{count} of {max}', { count: week.focus.length, max: MAX_FOCUS })}</span>
          </h2>
          <AddFocusDrawer goals={goals} opportunities={opportunities} full={week.focus.length >= MAX_FOCUS} />
        </div>
        {week.focus.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            {t('Up to three things that move your career this week: send an application, prepare an interview, finish a course.')}
          </p>
        ) : (
          <ul className="space-y-2">
            {week.focus.map((f) => (
              <FocusRow key={f.id} id={f.id} title={f.title} done={f.status === 'DONE'} carried={f.carryCount} />
            ))}
          </ul>
        )}
        <CarryButton open={open} />
      </section>

      {week.leftOver.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('Left from earlier weeks')}</h2>
          <ul className="space-y-2">
            {week.leftOver.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2.5">
                <span className="text-sm">{f.title}</span>
                <BringButton id={f.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('Quick log')}</h2>
        <QuickLog goals={goals} opportunities={opportunities} facts={week.facts} />
        {week.log.length > 0 ? (
          <ul className="space-y-2">
            {week.log.map((entry) => (
              <li key={entry.id} className="space-y-1 rounded-xl border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {date.format(entry.entryDate)}
                  {entry.title ? ` · ${entry.title}` : ''}
                </p>
                {entry.body ? <EntryBody body={entry.body} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {runway.hasPlan ? (
        <section className="space-y-1 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t('Runway')}</h2>
          <p className="text-2xl font-semibold text-node-accent">
            {runway.months === null ? '—' : t.plural(runway.months, '{count} month', '{count} months')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('{available} at hand, outside locked chests and borrowed money, ÷ {need} a month in your plan without its savings. A calculation, as of {date}.', {
              available: `${t.amount(runway.available)} ${CURRENCY_CODE}`,
              need: `${t.amount(runway.monthlyNeed)} ${CURRENCY_CODE}`,
              date: date.format(runway.asOf),
            })}
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('Coming up')}</h2>
        {week.deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('No deadline in the next two weeks.')}</p>
        ) : (
          <ul className="space-y-1.5">
            {week.deadlines.map((d) => (
              <li key={`${d.kind}-${d.id}`}>
                <Link
                  href={d.kind === 'goal' ? `/career/goals/${d.id}` : `/career/opportunities/${d.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-node-accent" aria-hidden="true" />
                    {d.title}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{date.format(d.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
