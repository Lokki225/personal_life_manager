import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { AreaChip } from '@/components/life-areas/area-chip'
import { listCareerGoals } from '@/application/career/goals'
import { listLifeAreas } from '@/application/lifeAreas/areas'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { STATUS_LABELS, statusTone } from '../../personal/goals/goal-labels'
import { canUseProjection } from '../../projection/access'
import { GoalDrawer } from './goal-forms'
import { summaryLines } from './goal-text'

export const metadata: Metadata = {
  title: 'Career goals | Personal Life Manager',
}

export default async function CareerGoalsPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [goals, areas] = await Promise.all([listCareerGoals(user.id, clockNow()), canUseProjection(user) ? listLifeAreas(user.id) : Promise.resolve([])])
  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Goals')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('What you want next, compared with where you stand.')}</p>
        </div>
        <GoalDrawer areas={areas.map((a) => ({ id: a.id, name: a.name }))} />
      </header>

      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Target className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Say what you want next')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('"A better job", "A software engineering role": then the criteria that make it better for you.')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => {
            const lines = summaryLines(t, goal.evaluation.summary)
            return (
              <li key={goal.id}>
                <Link href={`/career/goals/${goal.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-node-accent">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{goal.name}</p>
                      {goal.lifeArea ? <AreaChip area={goal.lifeArea} /> : null}
                      <Badge variant={statusTone(goal.evaluation.status) === 'success' ? 'default' : 'secondary'}>{t(STATUS_LABELS[goal.evaluation.status])}</Badge>
                    </div>
                    {lines.length > 0 ? (
                      lines.map((line) => (
                        <p key={line} className="text-sm text-muted-foreground">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('No criteria yet.')}</p>
                    )}
                    {goal.deadline ? <p className="text-xs text-muted-foreground">{t('By {date}', { date: date.format(goal.deadline) })}</p> : null}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
