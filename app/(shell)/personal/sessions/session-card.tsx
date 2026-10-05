'use client'

import { useEffect, useState, useTransition } from 'react'
import { CircleAlert, Clock, Loader2, Play, Square } from 'lucide-react'

import { useIsOffline } from '@/components/offline/connection'
import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { fieldAttributes } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { logSessionAction, startSessionAction, stopSessionAction } from './actions'

type Goal = { id: string; name: string }

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
}

// Counts up from the time already elapsed when the page was drawn, so it does
// not depend on the device's clock or time zone.
function Timer({ elapsedSeconds }: { elapsedSeconds: number }) {
  const [shownAt] = useState(() => Date.now())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(Math.floor((Date.now() - shownAt) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [shownAt])

  return <span className="tabular-nums">{clock(elapsedSeconds + tick)}</span>
}

export function SessionCard({
  running,
  goals,
  totalMinutes,
}: {
  running: { goalName: string | null; elapsedSeconds: number } | null
  goals: Goal[]
  totalMinutes: number
}) {
  const t = useT()
  const offline = useIsOffline()
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const act = (action: () => Promise<{ error: string | null }>) => startPending(async () => setError((await action()).error))

  return (
    <section aria-labelledby="sessions-title" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="sessions-title" className="font-semibold">
          {t('Sessions')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('{minutes} min today', { minutes: totalMinutes })}</p>
      </div>

      {running ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-node-accent/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{running.goalName ?? t('Session without a goal')}</p>
            <p className="text-2xl font-semibold text-node-accent">
              <Timer elapsedSeconds={running.elapsedSeconds} />
            </p>
          </div>
          <Button type="button" onClick={() => act(() => stopSessionAction(null))} disabled={pending || offline} className="h-11 shrink-0">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Square aria-hidden="true" />}
            {t('Stop')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {offline ? <p className="w-full text-xs text-muted-foreground">{t('Starting a timer needs a connection. Log the session instead.')}</p> : null}
          {goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              disabled={pending || offline}
              onClick={() => act(() => startSessionAction(goal.id))}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors outline-none hover:border-node-accent focus-visible:ring-[3px] focus-visible:ring-node-accent/40 disabled:opacity-50"
            >
              <Play className="size-3.5 text-node-accent" aria-hidden="true" />
              {goal.name}
            </button>
          ))}
          <button
            type="button"
            disabled={pending || offline}
            onClick={() => act(() => startSessionAction(null))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm text-muted-foreground transition-colors outline-none hover:border-node-accent focus-visible:ring-[3px] focus-visible:ring-node-accent/40 disabled:opacity-50"
          >
            <Play className="size-3.5" aria-hidden="true" />
            {t('Without a goal')}
          </button>
          <LogSessionDrawer goals={goals} />
        </div>
      )}

      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive-strong">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </section>
  )
}

function LogSessionDrawer({ goals }: { goals: Goal[] }) {
  const t = useT()
  const scope = 'log-session'

  return (
    <ActionDrawer
      worksOffline
      title={t('Log a session')}
      description={t('Time you already spent, ending now.')}
      trigger={
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-node-accent outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-node-accent/40"
        >
          <Clock className="size-3.5" aria-hidden="true" />
          {t('Log one')}
        </button>
      }
    >
      {(close) => (
        <ActionForm action={logSessionAction} submitLabel={t('Log session')} onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`${scope}-minutes`}>{t('Minutes')}</Label>
                <Input id={`${scope}-minutes`} {...fieldAttributes(state, 'minutes', scope)} inputMode="numeric" placeholder="45" className={FIELD_CLASS} />
                <FieldError state={state} name="minutes" scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${scope}-goal`}>{t('Goal (optional)')}</Label>
                <NativeSelect id={`${scope}-goal`} {...fieldAttributes(state, 'goalId', scope)} defaultValue="" className={FIELD_CLASS}>
                  <NativeSelectOption value="">{t('No goal')}</NativeSelectOption>
                  {goals.map((goal) => (
                    <NativeSelectOption key={goal.id} value={goal.id}>
                      {goal.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError state={state} name="goalId" scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${scope}-note`}>{t('Note (optional)')}</Label>
                <Input id={`${scope}-note`} {...fieldAttributes(state, 'note', scope)} maxLength={200} className={FIELD_CLASS} />
                <FieldError state={state} name="note" scope={scope} />
              </div>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
