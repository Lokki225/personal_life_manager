import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarClock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { getCareerGoal } from '@/application/career/goals'
import { levelOf } from '@/domain/goals/engine'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { STATUS_LABELS, statusTone } from '../../../personal/goals/goal-labels'
import { IMPORTANCE_LABELS, isoDay, LEVEL_HINTS, LEVEL_LABELS, RESULT_LABELS } from '../../labels'
import { AddCriterionDrawer, CriterionActions, GoalDrawer, GoalStateActions, JudgeDrawer } from '../goal-forms'
import { criterionText, sourceText, summaryLines, valueText } from '../goal-text'

export const metadata: Metadata = {
  title: 'Career goal | Personal Life Manager',
}

const RESULT_TONE = {
  MET: 'text-success',
  EXCEEDS: 'text-success',
  GAP: 'text-foreground',
  UNKNOWN: 'text-muted-foreground',
} as const

export default async function CareerGoalPage({ params }: PageProps<'/career/goals/[id]'>) {
  const [user, t, { id }] = await Promise.all([getSignedInUser(), getT(), params])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const goal = await getCareerGoal(user.id, id, clockNow())

  if (!goal) {
    notFound()
  }

  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const status = goal.evaluation.status
  const lines = summaryLines(t, goal.evaluation.summary)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link href="/career/goals" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('Goals')}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{goal.name}</h1>
          <Badge variant={statusTone(status) === 'success' ? 'default' : 'secondary'}>{t(STATUS_LABELS[status])}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {[
            goal.importance ? t(IMPORTANCE_LABELS[goal.importance]) : null,
            goal.deadline ? t('By {date}', { date: date.format(goal.deadline) }) : null,
            goal.supersededBy ? t('Replaced by {goal}', { goal: goal.supersededBy }) : null,
            goal.abandonReason,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {goal.why ? <p className="text-sm whitespace-pre-wrap">{goal.why}</p> : null}
        <div className="flex flex-wrap items-center gap-1">
          <GoalDrawer
            goal={{ id: goal.id, name: goal.name, why: goal.why, deadline: goal.deadline ? isoDay(goal.deadline) : null, importance: goal.importance }}
          />
        </div>
      </header>

      {status === 'CRITERIA_MET' ? (
        <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
          {t('Every required criterion is met. Is the goal reached? Mark it achieved when you say so.')}
        </p>
      ) : null}

      <GoalStateActions goalId={goal.id} status={status} others={goal.others} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{t('Compared with now')}</h2>
            {lines.map((line) => (
              <p key={line} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <AddCriterionDrawer goalId={goal.id} places={goal.places} />
        </div>

        {goal.criteria.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('No criteria yet. Add what makes it better for you: pay, how you work, a documented skill, your own judgement.')}
          </p>
        ) : (
          (['REQUIRED', 'PREFERRED', 'INFO'] as const).map((level) => {
            const items = goal.criteria.filter((c) => levelOf(c.result.condition) === level)
            if (items.length === 0) return null
            return (
              <div key={level} className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t(LEVEL_LABELS[level])} <span className="font-normal text-muted-foreground">· {t(LEVEL_HINTS[level])}</span>
                </h3>
                <ul className="space-y-2">
                  {items.map(({ result, criterion }) => {
                    const value = valueText(t, criterion, result)
                    const from = sourceText(t, result.describe)
                    const isJudgement = criterion?.kind === 'judgement'
                    return (
                      <li key={result.condition.id} className="space-y-1.5 rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">{criterionText(t, criterion)}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={cn('text-sm font-semibold', RESULT_TONE[result.result])}>{t(RESULT_LABELS[result.result])}</span>
                            {result.reviewDue ? (
                              <Badge variant="outline">
                                <CalendarClock aria-hidden="true" />
                                {t('Review due')}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[value, from, result.asOf ? t('as of {date}', { date: date.format(result.asOf) }) : null].filter(Boolean).join(' · ') ||
                            (isJudgement ? t('Not judged yet.') : t('Not known yet: add it on the Situation page.'))}
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          {isJudgement ? <JudgeDrawer conditionId={result.condition.id} label={criterionText(t, criterion)} again={result.asOf !== null} /> : null}
                          <CriterionActions goalId={goal.id} conditionId={result.condition.id} canReview={!isJudgement && result.result !== 'UNKNOWN' && result.asOf !== null} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </section>
    </main>
  )
}
