import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { listPersonalGoals, type GoalSummary } from '@/application/personal/goals'
import { listMeasures } from '@/application/personal/sessions'
import { ensureDefaultCategories } from '@/application/personal/tasks'
import { HORIZONS, type Horizon } from '@/domain/goals/presets'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import type { Translator } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { conditionLine } from './goal-display'
import { AreaChip } from '@/components/life-areas/area-chip'
import { listLifeAreas } from '@/application/lifeAreas/areas'

import { canUseCareer } from '../../career/access'
import { canUseProjection } from '../../projection/access'
import { NewGoalDrawer } from './goal-forms'
import { HORIZON_LABELS, STATUS_LABELS, statusTone, TIER_LABELS } from './goal-labels'

export default async function PersonalGoalsPage({ searchParams }: PageProps<'/personal/goals'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [goals, categories, series, areas] = await Promise.all([
    listPersonalGoals(user.id, clockNow()),
    ensureDefaultCategories(user.id),
    listMeasures(user.id),
    canUseProjection(user) ? listLifeAreas(user.id) : Promise.resolve([]),
  ])
  // The horizon filter lives in the address, so the switcher reopens on it.
  const horizon = HORIZONS.find((h) => h === params.horizon) ?? null
  const active = goals.filter((g) => g.evaluation.status !== 'ABANDONED')
  const abandoned = goals.filter((g) => g.evaluation.status === 'ABANDONED')
  const shown = horizon ? active.filter((g) => g.horizon === horizon) : active

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Goals')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.plural(active.length, '{count} goal in progress.', '{count} goals in progress.')}
          </p>
        </div>
        <NewGoalDrawer
          careerOpen={canUseCareer(user)}
          areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          categories={categories.map(({ id, name }) => ({ id, name }))}
          series={series.map((s) => ({ id: s.id, name: s.label, unit: s.unit }))}
        />
      </header>

      {active.length > 0 ? (
        <nav aria-label={t('Horizon')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {[null, ...HORIZONS].map((h) => (
            <Link
              key={h ?? 'all'}
              href={h ? `/personal/goals?horizon=${h}` : '/personal/goals'}
              aria-current={horizon === h ? 'page' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                horizon === h ? 'border-node-accent bg-node-accent text-on-node-accent' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {h ? t(HORIZON_LABELS[h]) : t('All')}
            </Link>
          ))}
        </nav>
      ) : null}

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Target className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Create your first goal')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('A rating to reach, hours to put in, steps, a habit or a list: your sessions, values and tasks will count towards it.')}
          </p>
        </div>
      ) : (
        (horizon ? [horizon] : HORIZONS).map((h) => {
          const group = shown.filter((g) => g.horizon === h)
          return group.length > 0 ? <HorizonGroup key={h} horizon={h} goals={group} t={t} /> : null
        })
      )}

      {abandoned.length > 0 && !horizon ? (
        <details className="rounded-xl border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t.plural(abandoned.length, '{count} abandoned goal', '{count} abandoned goals')}
          </summary>
          <ul className="mt-2 space-y-1">
            {abandoned.map((g) => (
              <li key={g.id}>
                <Link href={`/personal/goals/${g.id}`} className="text-sm hover:underline">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </main>
  )
}

function HorizonGroup({ horizon, goals, t }: { horizon: Horizon; goals: GoalSummary[]; t: Translator }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{t(HORIZON_LABELS[horizon])}</h2>
      <ul className="space-y-2">
        {goals.map((goal) => (
          <li key={goal.id}>
            <GoalCard goal={goal} t={t} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function GoalCard({ goal, t }: { goal: GoalSummary; t: Translator }) {
  const { evaluation } = goal
  const main = evaluation.completion[0]
  const health = evaluation.health[0]
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { month: 'long', year: 'numeric' })
  const tone = statusTone(evaluation.status)

  return (
    <Link href={`/personal/goals/${goal.id}`} className="block space-y-2.5 rounded-xl border bg-card p-4 transition-colors hover:border-node-accent/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{goal.name}</p>
          {goal.category ? <p className="text-xs text-node-accent">{t(goal.category.name)}</p> : null}
          {goal.lifeArea ? <AreaChip area={goal.lifeArea} className="mt-1" /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={tone === 'success' ? 'default' : 'secondary'}>{t(STATUS_LABELS[evaluation.status])}</Badge>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      {main ? (
        <>
          <Meter value={main.progress * 100} tone={evaluation.satisfied ? 'success' : 'node'} label={conditionLine(t, main)} />
          <p className="text-sm text-muted-foreground">{conditionLine(t, main, main.condition.unit)}</p>
        </>
      ) : null}
      {goal.deadline && evaluation.status !== 'ACHIEVED' ? (
        <p className="text-xs text-muted-foreground">
          {evaluation.projected
            ? t('At this pace: {date}', { date: dateFormatter.format(evaluation.projected) })
            : t('Not enough data yet to tell the pace.')}
        </p>
      ) : null}
      {health ? (
        <p className="text-xs text-muted-foreground">
          {conditionLine(t, health)} · {t(TIER_LABELS[health.tier])}
        </p>
      ) : null}
      {evaluation.milestones.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('{done} of {total} steps', {
            done: evaluation.milestones.filter((m) => m.completedAt).length,
            total: evaluation.milestones.length,
          })}
        </p>
      ) : null}
    </Link>
  )
}
