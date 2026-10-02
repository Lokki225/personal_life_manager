import { redirect } from 'next/navigation'
import { Check, Target, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { measurementLabel, operatorLabel } from '../goal-labels'
import { Meter, Money } from '../money'
import { CustomGoalDrawer } from './custom-goal-drawer'
import { FundGoalDrawer, NewGoalDrawer } from './goal-forms'
import { ensureDaysSettled } from '../settle'

export default async function FinanceGoalsPage() {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  if (!userId) {
    redirect('/login')
  }

  const state = await recomputeFinanceState({ userId })
  const reached = state.goals.filter((goal) => goal.satisfied).length
  // Only goals measured on a chest can receive money.
  const fundable = state.goals.filter((goal) =>
    goal.conditionResults.some((result) => result.measurement === 'chest_balance'),
  )

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Goals')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.goals.length > 0
            ? t('{reached} of {total} reached.', { reached: String(reached), total: String(state.goals.length) })
            : t('Give your savings something to aim for.')}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FundGoalDrawer
          goals={fundable.map((goal) => ({ id: goal.id, name: goal.name }))}
          chests={state.chests.map((chest) => ({ id: chest.id, name: chest.name, balance: chest.balance }))}
        />
        <NewGoalDrawer />
        <CustomGoalDrawer chests={state.chests.map((chest) => ({ id: chest.id, name: chest.name }))} />
      </div>

      {state.goals.length > 0 ? (
        <ul className="space-y-3">
          {state.goals.map((goal) => {
            // A single balance target reads honestly as one bar. Anything else
            // is shown condition by condition.
            const single =
              goal.conditionResults.length === 1 &&
              goal.conditionResults[0].measurement === 'chest_balance' &&
              goal.conditionResults[0].target > 0
                ? goal.conditionResults[0]
                : null

            return (
              <li key={goal.id}>
                <Card className="gap-0 py-4">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex min-w-0 items-start gap-2 font-medium">
                        <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="line-clamp-2">{goal.name}</span>
                      </p>
                      <Badge variant={goal.satisfied ? 'default' : 'secondary'} className="shrink-0">
                        {goal.satisfied ? t('Reached') : t('In progress')}
                      </Badge>
                    </div>

                    {single ? (
                      <>
                        <Meter
                          value={(single.actual / single.target) * 100}
                          tone={goal.satisfied ? 'success' : 'primary'}
                          label={t('Progress towards {goal}', { goal: goal.name })}
                        />
                        <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
                          <span>
                            <Money value={single.actual} className="font-medium text-foreground" /> {t('of')}{' '}
                            <Money value={single.target} />
                          </span>
                          {goal.satisfied ? null : (
                            <span>
                              <Money value={single.target - single.actual} className="font-medium text-foreground" />{' '}
                              {t('to go')}
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <ul className="space-y-2">
                        {goal.conditionResults.map((result, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span
                              className={cn(
                                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                                result.satisfied ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {result.satisfied ? (
                                <Check className="size-3.5" aria-label={t('Met')} />
                              ) : (
                                <X className="size-3.5" aria-label={t('Not met')} />
                              )}
                            </span>
                            <span>
                              {t(measurementLabel(result.measurement))}
                              {t(': ')}
                              <span className="font-medium">{t.amount(result.actual)}</span>
                              <span className="text-muted-foreground">
                                {' '}
                                ({t(operatorLabel(result.operator))} {t.amount(result.target)})
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {goal.borrowed > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('Of which')} <Money value={goal.borrowed} /> {t('borrowed')}
                        {goal.owed > 0 ? (
                          <>
                            , <Money value={goal.owed} className="font-medium text-foreground" /> {t('still owed')}
                          </>
                        ) : (
                          `, ${t('fully repaid')}`
                        )}
                        .
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <Target className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t('No goals yet')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Create one, such as a phone or an emergency fund, and fund it from your chests.')}
          </p>
        </div>
      )}
    </main>
  )
}
