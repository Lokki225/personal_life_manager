import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { getCareerReview, REVIEW_QUESTIONS } from '@/application/career/review'
import { addDays, parseWeek } from '@/domain/career/week'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { EntryBody } from '../../personal/journal/entry-view'
import { criterionText } from '../goals/goal-text'
import { isoDay, KIND_LABELS, OPPORTUNITY_STATUS_LABELS, OUTCOME_LABELS, RESULT_LABELS } from '../labels'
import { ReviewQuestions } from './review-forms'

export const metadata: Metadata = {
  title: 'Career review | Personal Life Manager',
}

export default async function CareerReviewPage({ searchParams }: PageProps<'/career/review'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const now = clockNow()
  const week = parseWeek(typeof params.week === 'string' ? params.week : null) ?? now
  const review = await getCareerReview(user.id, week, now)
  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short' })
  const lastDay = addDays(review.end, -1)
  // getDay(): 0 is Sunday; reviewDay: 7 is Sunday.
  const reviewDayToday = review.isCurrent && (now.getDay() || 7) === review.reviewDay
  const nothing =
    review.started.length + review.ended.length + review.evidence.length + review.moves.length + review.criteria.length === 0

  const list = (title: string, items: string[]) =>
    items.length > 0 ? (
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Review')}</h1>
        <nav aria-label={t('Week')} className="flex items-center justify-between gap-2">
          <Link href={`/career/review?week=${isoDay(addDays(review.start, -7))}`} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t('Week before')}
          </Link>
          <p className="text-sm font-medium">{t('{from} to {to}', { from: date.format(review.start), to: date.format(lastDay) })}</p>
          {review.isCurrent ? (
            <span className="w-24" />
          ) : (
            <Link href={`/career/review?week=${isoDay(review.end)}`} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              {t('Week after')}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </nav>
        {reviewDayToday ? <p className="rounded-lg border border-node-accent/40 bg-node-accent/10 px-3 py-2 text-sm">{t('Today is your review day.')}</p> : null}
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t('What changed')}</h2>
        {nothing ? <p className="text-sm text-muted-foreground">{t('Nothing changed in your situation, opportunities or criteria this week.')}</p> : null}
        {list(t('Started'), review.started.map((f) => `${t(KIND_LABELS[f.kind])}: ${f.title}`))}
        {list(t('Ended'), review.ended.map((f) => `${t(KIND_LABELS[f.kind])}: ${f.title}`))}
        {list(t('Evidence added'), review.evidence.map((e) => e.title))}
        {list(
          t('Opportunities moved'),
          review.moves.map((m) => `${m.title}: ${t(OPPORTUNITY_STATUS_LABELS[m.status])}${m.outcome ? ` · ${t(OUTCOME_LABELS[m.outcome] ?? m.outcome)}` : ''}`),
        )}
        {list(
          t('Criteria that changed'),
          review.criteria.map((c) => `${c.goal} · ${criterionText(t, c.criterion)}: ${t(RESULT_LABELS[c.from])} → ${t(RESULT_LABELS[c.to])}`),
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('Focus')}</h2>
        {review.focusDone.length + review.focusOpen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('No focus this week.')}</p>
        ) : (
          <>
            {list(t('Done'), review.focusDone)}
            {list(t('Not done'), review.focusOpen)}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('Two questions')}</h2>
        <p className="text-sm text-muted-foreground">{t('Optional. Your answers go to your Career log.')}</p>
        <ReviewQuestions forward={t(REVIEW_QUESTIONS.forward)} next={t(REVIEW_QUESTIONS.next)} />
      </section>

      {review.log.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('Log of the week')}</h2>
          <ul className="space-y-2">
            {review.log.map((entry) => (
              <li key={entry.id} className="space-y-1 rounded-xl border bg-card px-4 py-3">
                {entry.title ? <p className="text-xs font-medium text-node-accent">{entry.title}</p> : null}
                {entry.body ? <EntryBody body={entry.body} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
