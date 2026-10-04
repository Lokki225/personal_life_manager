import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'

import { ensureDefaultCategories, getTaskLists } from '@/application/personal/tasks'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { AddTaskDrawer, CARRY_REASON_LABELS, QuickAdd, TaskMeta, TaskMenu, TaskRow } from './task-forms'
import { toTaskView, type TaskView } from './task-view'

const FILTERS = [
  { id: 'all', label: m('All') },
  { id: 'inbox', label: m('Inbox') },
  { id: 'upcoming', label: m('Planned') },
  { id: 'repeating', label: m('Repeating') },
  { id: 'carried', label: m('Carried over') },
] as const

type Filter = (typeof FILTERS)[number]['id']

export default async function PersonalTasksPage({ searchParams }: PageProps<'/personal/tasks'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  // The filter lives in the address, so the switcher reopens on it.
  const filter: Filter = FILTERS.some((f) => f.id === params.filter) ? (params.filter as Filter) : 'all'
  const [lists, categories] = await Promise.all([getTaskLists(user.id, clockNow()), ensureDefaultCategories(user.id)])
  const show = (id: Filter) => filter === 'all' || filter === id

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Tasks')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.plural(lists.inbox.length, '{count} waiting in the inbox.', '{count} waiting in the inbox.')}
          </p>
        </div>
        <AddTaskDrawer categories={categories.map(({ id, name }) => ({ id, name }))} />
      </header>

      <nav aria-label={t('Filter tasks')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === 'all' ? '/personal/tasks' : `/personal/tasks?filter=${f.id}`}
            aria-current={filter === f.id ? 'page' : undefined}
            className={cn(
              'flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
              filter === f.id ? 'border-node-accent bg-node-accent text-on-node-accent' : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t(f.label)}
          </Link>
        ))}
      </nav>

      {lists.stillRelevant.length > 0 && show('carried') ? (
        <section aria-labelledby="relevant-title" className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <h2 id="relevant-title" className="font-semibold">
            {t('Still relevant?')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('These keep slipping. Do them, give them a day that works, or drop them.')}
          </p>
          <ul className="space-y-2">
            {lists.stillRelevant.map((task) => (
              <SimpleRow key={task.id} task={toTaskView(task)} />
            ))}
          </ul>
        </section>
      ) : null}

      {show('inbox') ? (
        <Section title={m('Inbox')} hint={m('Ideas without a day. Give them one when you are ready.')}>
          <QuickAdd when="inbox" />
          {lists.inbox.length > 0 ? (
            <ul className="space-y-2">
              {lists.inbox.map((task) => (
                <SimpleRow key={task.id} task={toTaskView(task)} />
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Inbox className="size-4" aria-hidden="true" />
              {t('The inbox is empty.')}
            </p>
          )}
        </Section>
      ) : null}

      {show('upcoming') ? (
        <Section title={m('Planned')} hint={m('One-off tasks from today on.')}>
          <TaskList tasks={lists.upcoming.map(toTaskView)} empty={m('Nothing planned.')} showDate />
        </Section>
      ) : null}

      {show('repeating') ? (
        <Section title={m('Repeating')} hint={m('They come back on their days. A missed day does not pile up.')}>
          <ul className="space-y-2">
            {lists.repeating.map((task) => (
              <SimpleRow key={task.id} task={toTaskView(task)} />
            ))}
          </ul>
          {lists.repeating.length === 0 ? <p className="py-2 text-sm text-muted-foreground">{t('No repeating tasks.')}</p> : null}
        </Section>
      ) : null}

      {show('carried') && filter === 'carried' ? (
        <Section title={m('Carried over')} hint={m('Tasks that slipped to a later day, and why.')}>
          <ul className="space-y-2">
            {lists.carried.map((task) => (
              <li key={task.id} className="rounded-xl border bg-card px-3 py-2.5">
                <p className="text-[15px]">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.carryReason
                    ? t(CARRY_REASON_LABELS[task.carryReason] ?? task.carryReason)
                    : t('No reason given')}
                </p>
              </li>
            ))}
          </ul>
          {lists.carried.length === 0 ? <p className="py-2 text-sm text-muted-foreground">{t('Nothing carried over.')}</p> : null}
        </Section>
      ) : null}
    </main>
  )
}

async function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const t = await getT()

  return (
    <section className="space-y-2">
      <div>
        <h2 className="font-semibold">{t(title)}</h2>
        <p className="text-sm text-muted-foreground">{t(hint)}</p>
      </div>
      {children}
    </section>
  )
}

async function TaskList({ tasks, empty, showDate = false }: { tasks: TaskView[]; empty: string; showDate?: boolean }) {
  const t = await getT()

  return tasks.length > 0 ? (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} done={false} showDate={showDate} />
      ))}
    </ul>
  ) : (
    <p className="py-2 text-sm text-muted-foreground">{t(empty)}</p>
  )
}

// A task without a tick box: it has no day to be done on, or it repeats.
function SimpleRow({ task }: { task: TaskView }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] leading-snug">{task.title}</p>
        <TaskMeta task={task} showDate />
      </div>
      <TaskMenu task={task} />
    </li>
  )
}
