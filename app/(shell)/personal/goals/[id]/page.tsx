import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check, Circle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { getPersonalGoal } from '@/application/personal/goals'
import { linkedEntries, linkOptions } from '@/application/personal/journal'
import { linkToken } from '@/domain/personal/journal'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { TaskMeta, TaskMenu, TaskRow } from '../../tasks/task-forms'
import { NewEntryDrawer } from '../../journal/entry-forms'
import { EntryCard } from '../../journal/entry-view'
import { toTaskView } from '../../tasks/task-view'
import { conditionLine, MetricChart } from '../goal-display'
import { AreaChip } from '@/components/life-areas/area-chip'
import { listLifeAreas } from '@/application/lifeAreas/areas'

import { canUseCareer } from '../../../career/access'
import { canUseProjection } from '../../../projection/access'
import { GoalAreaSelect } from '../../../projection/vision/area-forms'
import { AbandonDrawer, AddMilestoneForm, CareerRelevantToggle, GoalTaskForm, LogValueForm, SyncNowButton } from '../goal-forms'
import { HORIZON_LABELS, PRESET_LABELS, STATUS_LABELS, statusTone, TIER_LABELS } from '../goal-labels'

export default async function PersonalGoalPage({ params }: PageProps<'/personal/goals/[id]'>) {
  const [user, t, { id }] = await Promise.all([getSignedInUser(), getT(), params])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const now = clockNow()
  const [goal, entries, links, areas] = await Promise.all([
    getPersonalGoal(user.id, id, now),
    linkedEntries(user.id, 'goal', id),
    linkOptions(user.id),
    canUseProjection(user) ? listLifeAreas(user.id) : Promise.resolve([]),
  ])

  if (!goal) {
    notFound()
  }

  const { evaluation, tree } = goal
  const abandoned = evaluation.status === 'ABANDONED'
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', year: 'numeric' })
  const shortDate = new Intl.DateTimeFormat(t.intl, { weekday: 'short', day: 'numeric', month: 'short' })
  const sessionMinutes = goal.sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
  const main = evaluation.completion[0]
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <Link href="/personal/goals" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('Goals')}
      </Link>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{goal.name}</h1>
          {goal.lifeArea ? <AreaChip area={goal.lifeArea} /> : null}
          <Badge variant={statusTone(evaluation.status) === 'success' ? 'default' : 'secondary'} className="mt-1.5 shrink-0">
            {t(STATUS_LABELS[evaluation.status])}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {[
            goal.preset ? t(PRESET_LABELS[goal.preset]) : null,
            t(HORIZON_LABELS[goal.horizon]),
            goal.category ? t(goal.category.name) : null,
            tree.deadline ? t('by {date}', { date: dateFormatter.format(tree.deadline) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {tree.achievedAt ? (
          <p className="text-sm text-success">{t('Achieved on {date}', { date: dateFormatter.format(tree.achievedAt) })}</p>
        ) : null}
        {abandoned ? (
          <p className="text-sm text-muted-foreground">
            {t('Abandoned on {date}', { date: dateFormatter.format(tree.abandonedAt!) })}
            {goal.abandonReason ? ` · ${goal.abandonReason}` : ''}
          </p>
        ) : null}
      </header>

      {main ? (
        <section aria-labelledby="progress-title" className="space-y-3 rounded-xl border bg-card p-4">
          <h2 id="progress-title" className="sr-only">
            {t('Progress')}
          </h2>
          {evaluation.completion.map((result) => (
            <div key={result.condition.id} className="space-y-1.5">
              <p className="font-medium">{conditionLine(t, result, result.condition.unit)}</p>
              <Meter value={result.progress * 100} tone={result.satisfied ? 'success' : 'node'} label={conditionLine(t, result)} />
            </div>
          ))}
          {tree.deadline && evaluation.status !== 'ACHIEVED' && !abandoned ? (
            <p className="text-sm text-muted-foreground">
              {evaluation.projected
                ? t('At this pace: {date}', { date: dateFormatter.format(evaluation.projected) })
                : t('Not enough data yet to tell the pace.')}
            </p>
          ) : null}
          {evaluation.health.map((result) => (
            <p key={result.condition.id} className="text-sm text-muted-foreground">
              {conditionLine(t, result)} · {t(TIER_LABELS[result.tier])}
            </p>
          ))}
          {goal.series && !abandoned ? (
            <div className="space-y-2 border-t pt-3">
              <MetricChart entries={goal.entries} target={main.condition.target} label={t('{name} over time', { name: goal.series.label })} />
              {goal.sync ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <p>{t('Synced from chess.com: {account}', { account: goal.sync.account })}</p>
                    <p className="text-xs text-muted-foreground">
                      {goal.sync.lastSyncedAt
                        ? t('Last synced {date}', { date: new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(goal.sync.lastSyncedAt) })
                        : t('Not synced yet')}
                    </p>
                    {goal.sync.lastError ? <p className="text-xs text-warning">{t(goal.sync.lastError)}</p> : null}
                  </div>
                  <SyncNowButton seriesId={goal.series.id} />
                </div>
              ) : (
                <LogValueForm goalId={goal.id} unit={goal.series.unit} />
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {evaluation.milestones.length > 0 || goal.preset === 'milestones' ? (
        <section aria-labelledby="steps-title" className="space-y-2">
          <h2 id="steps-title" className="font-semibold">
            {t('Steps')}
          </h2>
          <ol className="space-y-1.5">
            {evaluation.milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-center gap-2.5 text-[15px]">
                {milestone.completedAt ? (
                  <Check className="size-5 shrink-0 text-success" aria-label={t('Done')} />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-label={t('Not done yet')} />
                )}
                <span className={cn(milestone.completedAt && 'text-muted-foreground')}>{milestone.name}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">{t('A step is done when all of its tasks are.')}</p>
          {abandoned ? null : <AddMilestoneForm goalId={goal.id} />}
        </section>
      ) : null}

      <section aria-labelledby="goal-tasks-title" className="space-y-2">
        <h2 id="goal-tasks-title" className="font-semibold">
          {t('Tasks')}
        </h2>
        {goal.tasks.length > 0 ? (
          <ul className="space-y-2">
            {goal.tasks.map((task) => {
              const view = toTaskView(task)
              const step = tree.milestones.find((m) => m.id === task.milestoneId)
              // A task with a day can be ticked; one in the inbox waits for a day.
              return task.dueDate || task.recurrence ? (
                <TaskRow key={task.id} task={{ ...view, category: step?.name ?? view.category }} done={task.status === 'DONE'} showDate />
              ) : (
                <li key={task.id} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[15px]">{task.title}</p>
                    <TaskMeta task={{ ...view, category: step?.name ?? view.category }} />
                  </div>
                  <TaskMenu task={view} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('No tasks for this goal yet.')}</p>
        )}
        {abandoned ? null : <GoalTaskForm goalId={goal.id} milestones={tree.milestones.map((m) => ({ id: m.id, name: m.name }))} />}
      </section>

      <section aria-labelledby="goal-sessions-title" className="space-y-2">
        <h2 id="goal-sessions-title" className="font-semibold">
          {t('Sessions this week')}
        </h2>
        {goal.sessions.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t.plural(goal.sessions.length, '{count} session, {minutes} min.', '{count} sessions, {minutes} min.', { minutes: sessionMinutes })}
            </p>
            <ul className="divide-y rounded-xl border bg-card">
              {goal.sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    {session.startedAt >= today ? t('Today') : shortDate.format(session.startedAt)}
                    {session.note ? <span className="text-muted-foreground"> · {session.note}</span> : null}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{t('{minutes} min', { minutes: session.durationMin ?? 0 })}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('No sessions in the last 7 days. Start one from Today.')}</p>
        )}
      </section>

      <section aria-labelledby="goal-journal-title" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="goal-journal-title" className="font-semibold">
            {t('Journal')}
          </h2>
          <NewEntryDrawer
            links={links}
            today={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}
            label={t('Write about it')}
            initialBody={`${linkToken({ targetType: 'goal', targetId: goal.id, label: goal.name })} `}
          />
        </div>
        {entries.length > 0 ? (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('No entries mention this goal yet.')}</p>
        )}
      </section>

      {abandoned ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-4">
            {canUseCareer(user) ? <CareerRelevantToggle goalId={goal.id} value={goal.careerRelevant} /> : null}
            <GoalAreaSelect goalId={goal.id} value={goal.lifeArea?.id ?? null} areas={areas} />
          </div>
          <AbandonDrawer goalId={goal.id} />
        </div>
      )}
    </main>
  )
}
