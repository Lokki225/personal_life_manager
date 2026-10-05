'use client'

import { startTransition, useActionState, useOptimistic, useState, useTransition, type FormEvent } from 'react'
import { Check, CircleAlert, Ellipsis, Loader2, Plus, Repeat } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { useIsOffline } from '@/components/offline/connection'
import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CARRY_REASONS } from '@/domain/personal/tasks'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import {
  addTaskAction,
  capacityAction,
  carryReasonAction,
  deleteTaskAction,
  dropTaskAction,
  scheduleTaskAction,
  toggleTaskAction,
} from './actions'
import type { TaskView } from './task-view'

const scope = 'task'

export const CARRY_REASON_LABELS: Record<string, string> = {
  no_time: m('No time'),
  low_energy: m('Low energy'),
  blocked: m('Blocked'),
  not_relevant: m('Not relevant any more'),
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive-strong">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null
}

// A task with its tick box. Ticking shows at once; the server catches up.
export function TaskRow({ task, done, showDate = false }: { task: TaskView; done: boolean; showDate?: boolean }) {
  const t = useT()
  const [optimisticDone, setOptimisticDone] = useOptimistic(done)
  const [error, setError] = useState<string | null>(null)

  const toggle = () =>
    startTransition(async () => {
      setOptimisticDone(!optimisticDone)
      setError((await toggleTaskAction(task.id, !optimisticDone)).error)
    })

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={optimisticDone}
        aria-label={t('Done: {task}', { task: task.title })}
        onClick={toggle}
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-node-accent/40',
          optimisticDone ? 'border-success bg-success text-white' : 'border-input hover:border-node-accent',
        )}
      >
        {optimisticDone ? <Check className="size-4" aria-hidden="true" /> : null}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn('text-[15px] leading-snug', optimisticDone && 'text-muted-foreground line-through')}>{task.title}</p>
        <TaskMeta task={task} showDate={showDate} />
        <ErrorLine error={error} />
      </div>
      <TaskMenu task={task} />
    </li>
  )
}

export function TaskMeta({ task, showDate = false }: { task: TaskView; showDate?: boolean }) {
  const t = useT()
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'short', day: 'numeric', month: 'short' })
  const parts = [
    task.category ? (
      <span key="c" className="rounded-full bg-node-accent/12 px-2 py-0.5 font-medium text-node-accent">
        {t(task.category)}
      </span>
    ) : null,
    task.repeats ? (
      <span key="r" className="inline-flex items-center gap-1">
        <Repeat className="size-3" aria-hidden="true" />
        {t('Repeats')}
      </span>
    ) : null,
    task.carryCount > 0 ? (
      <span key="k" className="text-warning">
        {t.plural(task.carryCount, 'Carried over {count} time', 'Carried over {count} times')}
      </span>
    ) : null,
    showDate && task.dueDate && !task.repeats ? (
      <span key="d">{dateFormatter.format(new Date(`${task.dueDate}T00:00:00`))}</span>
    ) : null,
  ].filter(Boolean)

  return parts.length > 0 ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{parts}</div> : null
}

const MENU_ITEM =
  'flex min-h-11 cursor-pointer items-center rounded-md px-2.5 text-sm outline-none select-none data-[highlighted]:bg-accent'

// Move a task to another day, to the inbox, or get rid of it.
export function TaskMenu({ task }: { task: TaskView }) {
  const t = useT()
  const offline = useIsOffline()
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const act = (action: () => Promise<{ error: string | null }>) =>
    startPending(async () => setError((await action()).error))

  return (
    <div className="flex flex-col items-end">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="-mr-1 flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-node-accent/40"
          aria-label={t('Options for {task}', { task: task.title })}
          disabled={pending || offline}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Ellipsis className="size-5" aria-hidden="true" />}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-soft)]"
          >
            {task.repeats ? null : (
              <>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => act(() => scheduleTaskAction(task.id, 'today'))}>
                  {t('Do it today')}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => act(() => scheduleTaskAction(task.id, 'tomorrow'))}>
                  {t('Move to tomorrow')}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => act(() => scheduleTaskAction(task.id, 'inbox'))}>
                  {t('Back to the inbox')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
              </>
            )}
            <DropdownMenu.Item className={MENU_ITEM} onSelect={() => act(() => dropTaskAction(task.id))}>
              {t('Drop it')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={cn(MENU_ITEM, 'text-destructive-strong')}
              onSelect={() => act(() => deleteTaskAction(task.id))}
            >
              {t('Delete')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ErrorLine error={error} />
    </div>
  )
}

// Title only, for today. The fastest way in.
export function QuickAdd({ when = 'today' }: { when?: 'today' | 'inbox' }) {
  const t = useT()
  const offline = useIsOffline()
  const [formKey, setFormKey] = useState(0)
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const next = await addTaskAction(previous, formData)
    if (next.status === 'success') setFormKey((key) => key + 1)
    return next
  }, initialFormState)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form key={formKey} onSubmit={submit} className="space-y-1.5" noValidate>
      <input type="hidden" name="when" value={when} />
      <div className="flex gap-2">
        <Label htmlFor={`quick-${when}`} className="sr-only">
          {when === 'today' ? t('Add a task for today') : t('Add to the inbox')}
        </Label>
        <Input
          id={`quick-${when}`}
          {...fieldAttributes(state, 'title', `quick-${when}`)}
          placeholder={when === 'today' ? t('Add a task for today') : t('Add to the inbox')}
          maxLength={120}
          autoComplete="off"
          className={FIELD_CLASS}
        />
        <Button type="submit" disabled={isPending || offline} className="h-12 shrink-0 px-4" aria-label={t('Add')} title={offline ? t('Adding a task needs a connection.') : undefined}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        </Button>
      </div>
      <FieldError state={state} name="title" scope={`quick-${when}`} />
      {state.formErrors[0] ? <ErrorLine error={state.formErrors[0]} /> : null}
    </form>
  )
}

const WEEKDAY_LABELS = [m('Mon'), m('Tue'), m('Wed'), m('Thu'), m('Fri'), m('Sat'), m('Sun')]

function TaskFields({ state, categories }: { state: FormState; categories: { id: string; name: string }[] }) {
  const t = useT()
  const [when, setWhen] = useState('today')
  const [repeat, setRepeat] = useState('none')
  const id = (field: string) => `${scope}-${field}`

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={id('title')}>{t('Task')}</Label>
        <Input id={id('title')} {...fieldAttributes(state, 'title', scope)} placeholder={t('Call home')} maxLength={120} className={FIELD_CLASS} />
        <FieldError state={state} name="title" scope={scope} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id('repeat')}>{t('Repeats')}</Label>
        <NativeSelect
          id={id('repeat')}
          {...fieldAttributes(state, 'repeat', scope)}
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          className={FIELD_CLASS}
        >
          <NativeSelectOption value="none">{t('Once')}</NativeSelectOption>
          <NativeSelectOption value="daily">{t('Every day')}</NativeSelectOption>
          <NativeSelectOption value="weekdays">{t('Monday to Friday')}</NativeSelectOption>
          <NativeSelectOption value="weekly">{t('On chosen days')}</NativeSelectOption>
          <NativeSelectOption value="everyN">{t('Every few days')}</NativeSelectOption>
        </NativeSelect>
        <FieldError state={state} name="repeat" scope={scope} />
      </div>

      {repeat === 'weekly' ? (
        <fieldset className="grid grid-cols-7 gap-1">
          <legend className="sr-only">{t('Days')}</legend>
          {WEEKDAY_LABELS.map((label, index) => (
            <label key={label} className="cursor-pointer">
              <input type="checkbox" name={`day${index + 1}`} className="peer sr-only" />
              <span className="flex h-11 items-center justify-center rounded-md border border-input text-xs font-medium peer-checked:border-node-accent peer-checked:bg-node-accent peer-checked:text-on-node-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-node-accent/40">
                {t(label)}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {repeat === 'everyN' ? (
        <div className="grid gap-2">
          <Label htmlFor={id('every')}>{t('Every how many days')}</Label>
          <Input id={id('every')} {...fieldAttributes(state, 'every', scope)} type="number" inputMode="numeric" min={1} max={99} placeholder="3" className={FIELD_CLASS} />
          <FieldError state={state} name="every" scope={scope} />
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={id('when')}>{repeat === 'none' ? t('When') : t('Starting')}</Label>
        <NativeSelect id={id('when')} {...fieldAttributes(state, 'when', scope)} value={when} onChange={(event) => setWhen(event.target.value)} className={FIELD_CLASS}>
          <NativeSelectOption value="today">{t('Today')}</NativeSelectOption>
          <NativeSelectOption value="tomorrow">{t('Tomorrow')}</NativeSelectOption>
          <NativeSelectOption value="date">{t('On a date')}</NativeSelectOption>
          {repeat === 'none' ? <NativeSelectOption value="inbox">{t('No date yet (inbox)')}</NativeSelectOption> : null}
        </NativeSelect>
        <FieldError state={state} name="when" scope={scope} />
      </div>

      {when === 'date' ? (
        <div className="grid gap-2">
          <Label htmlFor={id('date')}>{t('Date')}</Label>
          <Input id={id('date')} {...fieldAttributes(state, 'date', scope)} type="date" className={FIELD_CLASS} />
          <FieldError state={state} name="date" scope={scope} />
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={id('categoryId')}>{t('Category (optional)')}</Label>
        <NativeSelect id={id('categoryId')} {...fieldAttributes(state, 'categoryId', scope)} defaultValue="" className={FIELD_CLASS}>
          <NativeSelectOption value="">{t('No category')}</NativeSelectOption>
          {categories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {t(category.name)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError state={state} name="categoryId" scope={scope} />
      </div>
    </>
  )
}

export function AddTaskDrawer({ categories }: { categories: { id: string; name: string }[] }) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('New task')}
      description={t('A day, a repetition and a category are all optional.')}
      trigger={
        <Button variant="outline" className="h-11">
          <Plus aria-hidden="true" />
          {t('New task')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={addTaskAction} submitLabel={t('Add task')} onDone={close}>
          {(state) => <TaskFields state={state} categories={categories} />}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

// One tap to say why a task slipped to today.
export function CarryReasons({ tasks }: { tasks: TaskView[] }) {
  const t = useT()

  return (
    <section aria-labelledby="carry-title" className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <div>
        <h2 id="carry-title" className="font-semibold">
          {t('Moved from an earlier day')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('Why did they slip? One tap each, or skip it.')}</p>
      </div>
      <ul className="space-y-3">
        {tasks.map((task) => (
          <CarryReasonRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  )
}

function CarryReasonRow({ task }: { task: TaskView }) {
  const t = useT()
  const offline = useIsOffline()
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="space-y-1.5">
      <p className="text-sm font-medium">{task.title}</p>
      <div className="flex flex-wrap gap-1.5">
        {CARRY_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            disabled={pending || offline}
            onClick={() => startPending(async () => setError((await carryReasonAction(task.id, reason)).error))}
            className="min-h-9 rounded-full border bg-card px-3 text-xs font-medium transition-colors outline-none hover:border-node-accent focus-visible:ring-[3px] focus-visible:ring-node-accent/40 disabled:opacity-50"
          >
            {t(CARRY_REASON_LABELS[reason])}
          </button>
        ))}
      </div>
      <ErrorLine error={error} />
    </li>
  )
}

export function CapacityForm({ capacity }: { capacity: number }) {
  const t = useT()
  const offline = useIsOffline()
  const [state, formAction, isPending] = useActionState(capacityAction, initialFormState)

  return (
    <form
      action={formAction}
      onChange={(event) => event.currentTarget.requestSubmit()}
      className="flex items-center gap-2 text-sm"
    >
      <Label htmlFor="capacity" className="text-muted-foreground">
        {t('Tasks a day can hold')}
      </Label>
      <NativeSelect id="capacity" name="capacity" defaultValue={String(capacity)} disabled={isPending || offline} className="h-10 w-20">
        {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
          <NativeSelectOption key={n} value={String(n)}>
            {n}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {state.formErrors[0] || state.fieldErrors.capacity?.[0] ? (
        <ErrorLine error={state.formErrors[0] ?? state.fieldErrors.capacity![0]} />
      ) : null}
    </form>
  )
}
