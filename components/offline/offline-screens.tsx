'use client'

import { useEffect, useState } from 'react'
import { Check, CloudOff, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { CURRENCY_CODE, todayFigures } from '@/domain/finance/calculations'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { offlineDb, offlineUser } from '@/lib/offline/db'
import {
  SNAPSHOT_PATHS,
  snapshotKeyFor,
  STALE_AFTER_MS,
  type FinanceReviewSnapshot,
  type FinanceTodaySnapshot,
  type PersonalReviewSnapshot,
  type PersonalTodaySnapshot,
  type SnapshotKey,
} from '@/lib/offline/snapshots'
import { cn } from '@/lib/utils'

// The address that was asked for, read as soon as this file loads: the
// service worker answered it with the offline page, and the router may
// rewrite the address once it starts.
const askedPath = typeof window === 'undefined' ? '/' : window.location.pathname

// `now` is taken once, when the snapshot is read.
type Loaded = { key: SnapshotKey; data: unknown; savedAt: number; now: number } | null

// The screens readable offline (Ressources/offline-mode-codebase-plan.md,
// step 4), drawn from what the last online visit left on this device.
export function OfflineScreens() {
  const t = useT()
  const [loaded, setLoaded] = useState<Loaded | 'loading'>('loading')
  const key = snapshotKeyFor(askedPath)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const userId = offlineUser()
      const store = offlineDb()
      const row = key && userId && store ? await store.snapshots.get({ userId, key } as never).catch(() => undefined) : undefined
      if (!cancelled) setLoaded(row && key ? { key, data: row.data, savedAt: row.savedAt, now: Date.now() } : null)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [key])

  if (loaded === 'loading') {
    return null
  }

  return (
    <div className="w-full space-y-4">
      <nav aria-label={t('Readable offline')} className="flex flex-wrap justify-center gap-2 text-sm">
        {(Object.keys(SNAPSHOT_PATHS) as SnapshotKey[]).map((screen) => (
          // Full page loads: each one is answered by the offline page again.
          <a
            key={screen}
            href={SNAPSHOT_PATHS[screen]}
            aria-current={screen === key ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5',
              screen === key ? 'border-node-accent bg-node-accent text-on-node-accent' : 'bg-card text-muted-foreground',
            )}
          >
            {t(SCREEN_LABELS[screen])}
          </a>
        ))}
      </nav>

      {loaded ? (
        <>
          <SavedAt savedAt={loaded.savedAt} now={loaded.now} />
          {loaded.key === 'finance.today' ? <FinanceToday data={loaded.data as FinanceTodaySnapshot} /> : null}
          {loaded.key === 'finance.review' ? <FinanceReview data={loaded.data as FinanceReviewSnapshot} /> : null}
          {loaded.key === 'personal.today' ? <PersonalToday data={loaded.data as PersonalTodaySnapshot} /> : null}
          {loaded.key === 'personal.review' ? <PersonalReview data={loaded.data as PersonalReviewSnapshot} /> : null}
        </>
      ) : (
        <div className="space-y-3 py-6 text-center">
          <CloudOff className="mx-auto size-10 text-warning" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">{t('You are offline')}</h1>
          <p className="text-muted-foreground">{t("This page hasn't been opened yet on this device. Connect to load it.")}</p>
        </div>
      )}

      <div className="flex justify-center">
        <Button type="button" variant="outline" className="h-11" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" />
          {t('Try again')}
        </Button>
      </div>
    </div>
  )
}

const SCREEN_LABELS: Record<SnapshotKey, string> = {
  'finance.today': m('Finance · Today'),
  'finance.review': m('Finance · Review'),
  'personal.today': m('Personal · Today'),
  'personal.review': m('Personal · Review'),
}

function SavedAt({ savedAt, now }: { savedAt: number; now: number }) {
  const t = useT()
  const saved = new Date(savedAt)
  const sameDay = saved.toDateString() === new Date(now).toDateString()
  const time = new Intl.DateTimeFormat(t.intl, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(saved)
  const stale = now - savedAt > STALE_AFTER_MS

  return (
    <p className={cn('rounded-lg px-3 py-2 text-center text-sm', stale ? 'bg-warning/15 font-medium text-warning' : 'bg-muted text-muted-foreground')}>
      {stale
        ? t('Last updated {count} days ago. Connect to see where things stand.', { count: Math.floor((now - savedAt) / 86_400_000) })
        : t('Offline · as of {time}', { time })}
    </p>
  )
}

function useMoney() {
  const t = useT()
  return (value: number) => `${t.amount(value)} ${CURRENCY_CODE}`
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className={cn('text-lg font-semibold tabular-nums', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive-strong')}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function FinanceToday({ data }: { data: FinanceTodaySnapshot }) {
  const t = useT()
  const money = useMoney()
  const { remaining, overspend } = todayFigures({ budget: data.budget, spent: data.spent, saved: data.saved })

  return (
    <section className="space-y-3">
      <div className="rounded-xl border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">{overspend > 0 ? t('Over today') : t('Left today')}</p>
        <p className={cn('text-4xl font-semibold tabular-nums', overspend > 0 ? 'text-destructive-strong' : 'text-success')}>
          {money(overspend > 0 ? overspend : remaining)}
        </p>
        <p className="text-xs text-muted-foreground">{t('Daily budget: {amount}', { amount: money(data.budget) })}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t('Spent today')} value={money(data.spent)} />
        <Tile label={t('This month')} value={money(data.monthSpent)} tone={data.monthSpent > data.monthBudget ? 'bad' : undefined} />
        <Tile label={t('Saved')} value={money(data.totalSaved)} />
      </div>
      {data.expenses.length > 0 ? (
        <ul className="divide-y rounded-xl border bg-card">
          {data.expenses.map((expense, index) => (
            <li key={index} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span>
                {t(expense.category)}
                {expense.description ? <span className="text-muted-foreground"> · {expense.description}</span> : null}
              </span>
              <span className="tabular-nums">{money(expense.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="divide-y rounded-xl border bg-card">
        {data.chests.map((chest) => (
          <li key={chest.name} className="flex justify-between gap-3 px-3 py-2 text-sm">
            <span>{t(chest.name)}</span>
            <span className="tabular-nums">{money(chest.balance)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FinanceReview({ data }: { data: FinanceReviewSnapshot }) {
  const t = useT()
  const money = useMoney()

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Tile label={t('Planned')} value={money(data.plannedBudget)} />
        <Tile label={t('Spent')} value={money(data.actualSpent)} tone={data.actualSpent > data.plannedBudget ? 'bad' : undefined} />
        <Tile label={t('Remaining')} value={money(data.remaining)} tone={data.remaining >= 0 ? 'good' : 'bad'} />
        <Tile label={t('Saved')} value={money(data.actualSavings)} />
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {data.categories.map((category) => (
          <li key={category.category} className="flex justify-between gap-3 px-3 py-2 text-sm">
            <span>{t(category.category)}</span>
            <span className="tabular-nums">{money(category.total)}</span>
          </li>
        ))}
      </ul>
      <GoalList goals={data.goals} />
    </section>
  )
}

function GoalList({ goals }: { goals: { name: string; satisfied: boolean }[] }) {
  const t = useT()
  if (goals.length === 0) return null
  return (
    <ul className="space-y-1 text-sm">
      {goals.map((goal) => (
        <li key={goal.name} className="flex items-center gap-2">
          <Check className={cn('size-4', goal.satisfied ? 'text-success' : 'text-muted-foreground/40')} aria-hidden="true" />
          {goal.name}
          <span className="sr-only">{goal.satisfied ? t('Reached') : t('In progress')}</span>
        </li>
      ))}
    </ul>
  )
}

function PersonalToday({ data }: { data: PersonalTodaySnapshot }) {
  const t = useT()

  return (
    <section className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t('Tasks today')}</p>
        <p className="text-3xl font-semibold tabular-nums">
          {data.done}
          <span className="text-xl text-muted-foreground"> / {data.planned}</span>
        </p>
        <Meter value={data.planned ? (data.done / data.planned) * 100 : 0} tone="node" label={t('{done} of {planned} tasks done', { done: data.done, planned: data.planned })} />
      </div>
      <ul className="space-y-1.5">
        {data.tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Check className={cn('size-4 shrink-0', task.done ? 'text-success' : 'text-muted-foreground/30')} aria-hidden="true" />
            <span className={cn(task.done && 'text-muted-foreground line-through')}>{task.title}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{t('{minutes} min today', { minutes: data.sessionMinutes })}</p>
      {data.dailyNote ? <blockquote className="border-l-2 border-node-accent pl-3 text-sm">{data.dailyNote}</blockquote> : null}
    </section>
  )
}

function PersonalReview({ data }: { data: PersonalReviewSnapshot }) {
  const t = useT()
  const hours = (minutes: number) => new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(minutes / 60)

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t('Tasks done')} value={String(data.tasksDone)} />
        <Tile label={t('Days slipped')} value={String(data.slips)} />
        <Tile label={t('Hours in sessions')} value={hours(data.sessionMinutes)} />
      </div>
      {[
        { label: t('On track'), names: data.onTrack },
        { label: t('Behind'), names: data.behind },
        { label: t('Achieved'), names: data.achieved },
        { label: t('Habits kept'), names: data.habitsKept },
        { label: t('Habits slipping'), names: data.habitsSlipping },
      ]
        .filter((row) => row.names.length > 0)
        .map((row) => (
          <p key={row.label} className="text-sm">
            <span className="font-medium">{row.label}</span> · <span className="text-muted-foreground">{row.names.join(', ')}</span>
          </p>
        ))}
    </section>
  )
}
