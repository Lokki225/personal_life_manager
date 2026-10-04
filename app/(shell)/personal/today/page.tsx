import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ListChecks } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Meter } from '@/components/ui/meter'
import { listPersonalGoals } from '@/application/personal/goals'
import { getDailyNote } from '@/application/personal/journal'
import { getSessionsToday } from '@/application/personal/sessions'
import { ensureDefaultCategories, getTodayTasks } from '@/application/personal/tasks'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { DailyLine } from '../journal/entry-forms'
import { SessionCard } from '../sessions/session-card'
import { AddTaskDrawer, CapacityForm, CarryReasons, QuickAdd, TaskRow } from '../tasks/task-forms'
import { toTaskView } from '../tasks/task-view'

export default async function PersonalTodayPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const now = clockNow()
  const [{ entries, load, awaitingReason }, categories, sessions, goals, dailyNote] = await Promise.all([
    getTodayTasks(user.id, now),
    ensureDefaultCategories(user.id),
    getSessionsToday(user.id, now),
    listPersonalGoals(user.id, now),
    getDailyNote(user.id, now),
  ])
  // Goals timed by sessions can be started from here.
  const timedGoals = goals
    .filter((g) => g.usesSessions && g.evaluation.status !== 'ABANDONED' && g.evaluation.status !== 'ACHIEVED')
    .map((g) => ({ id: g.id, name: g.name }))
  const dateLine = new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  // Open tasks first, done ones after, each group in its own order.
  const ordered = [...entries.filter((e) => !e.done), ...entries.filter((e) => e.done)]

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Today')}</h1>
        <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{dateLine}</p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-3 px-5">
          <p className="text-sm text-muted-foreground">{t('Tasks today')}</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {load.done}
            <span className="text-2xl text-muted-foreground"> / {load.planned}</span>
          </p>
          <Meter
            value={load.progress * 100}
            tone={load.planned > 0 && load.done === load.planned ? 'success' : 'node'}
            label={t('{done} of {planned} tasks done', { done: load.done, planned: load.planned })}
          />
          <p className={cn('text-sm', load.overCapacity ? 'text-warning' : 'text-muted-foreground')}>
            {load.overCapacity
              ? t('{planned} tasks planned for a day that holds {capacity}. Move some to another day?', {
                  planned: load.planned,
                  capacity: load.capacity,
                })
              : t('Room for {capacity} tasks a day.', { capacity: load.capacity })}
          </p>
        </CardContent>
      </Card>

      <SessionCard
        running={
          sessions.running
            ? { goalName: sessions.running.goal?.name ?? null, elapsedSeconds: sessions.running.elapsedSeconds }
            : null
        }
        goals={timedGoals}
        totalMinutes={sessions.totalMinutes}
      />

      {awaitingReason.length > 0 ? <CarryReasons tasks={awaitingReason.map(toTaskView)} /> : null}

      <QuickAdd />

      {ordered.length > 0 ? (
        <ul className="space-y-2" aria-label={t('Tasks today')}>
          {ordered.map(({ task, done }) => (
            <TaskRow key={task.id} task={toTaskView(task)} done={done} />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <ListChecks className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Nothing planned for today')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('Add a task above, or pick one from your inbox.')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <AddTaskDrawer categories={categories.map(({ id, name }) => ({ id, name }))} />
        <Link
          href="/personal/tasks"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-node-accent hover:underline"
        >
          {t('All tasks and inbox')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <DailyLine body={dailyNote?.body ?? null} />

      <CapacityForm capacity={load.capacity} />
    </main>
  )
}
