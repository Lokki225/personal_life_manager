'use client'

import { startTransition, useActionState, useOptimistic, useState, useTransition, type FormEvent } from 'react'
import { Check, CircleAlert, CornerDownRight, Loader2, Plus, X } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { OPPORTUNITY_STATUSES, OUTCOMES } from '@/domain/career/opportunities'
import { FACT_KINDS } from '@/domain/career/situation'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { Field, Textarea, TextField } from '../fields'
import { KIND_LABELS, OPPORTUNITY_STATUS_LABELS, OUTCOME_LABELS } from '../labels'
import { addFocusAction, bringAction, carryAction, focusDoneAction, removeFocusAction, writeLogAction } from './actions'
import { LOG_ALSO } from './schema'

type Option = { id: string; name: string }

function useOneTap() {
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const act = (action: () => Promise<{ error: string | null }>) => startPending(async () => setError((await action()).error))
  return { pending, error, setError, act, startPending }
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="flex w-full items-center gap-1.5 text-xs text-destructive-strong">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null
}

function GoalAndOpportunity({ state, scope, goals, opportunities }: { state: FormState; scope: string; goals: Option[]; opportunities: Option[] }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field state={state} name="goalId" label={t('Goal (optional)')} scope={scope}>
        <NativeSelect id={`${scope}-goalId`} {...fieldAttributes(state, 'goalId', scope)} defaultValue="" className={FIELD_CLASS}>
          <NativeSelectOption value="">{t('None')}</NativeSelectOption>
          {goals.map((g) => (
            <NativeSelectOption key={g.id} value={g.id}>
              {g.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field state={state} name="opportunityId" label={t('Opportunity (optional)')} scope={scope}>
        <NativeSelect id={`${scope}-opportunityId`} {...fieldAttributes(state, 'opportunityId', scope)} defaultValue="" className={FIELD_CLASS}>
          <NativeSelectOption value="">{t('None')}</NativeSelectOption>
          {opportunities.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {o.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  )
}

export function AddFocusDrawer({ goals, opportunities, full }: { goals: Option[]; opportunities: Option[]; full: boolean }) {
  const t = useT()
  const scope = 'focus'

  if (full) {
    return (
      <Button type="button" variant="outline" className="h-10" disabled title={t('Three focus items a week at most. Finish or move one first.')}>
        <Plus aria-hidden="true" />
        {t('Add focus')}
      </Button>
    )
  }

  return (
    <ActionDrawer
      title={t('A focus for this week')}
      description={t('One of at most three things that move your career this week.')}
      trigger={
        <Button type="button" variant="outline" className="h-10">
          <Plus aria-hidden="true" />
          {t('Add focus')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={addFocusAction} submitLabel={t('Add')} onDone={close}>
          {(state) => (
            <>
              <TextField state={state} scope={scope} name="title" label={t('What you will do')} maxLength={120} />
              <GoalAndOpportunity state={state} scope={scope} goals={goals} opportunities={opportunities} />
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

// A focus item with its tick box. Ticking shows at once; the server catches up.
export function FocusRow({ id, title, done, carried }: { id: string; title: string; done: boolean; carried: number }) {
  const t = useT()
  const [shown, setShown] = useOptimistic(done)
  const { error, setError } = useOneTap()
  const [pending, startPending] = useTransition()

  const toggle = () =>
    startTransition(async () => {
      setShown(!shown)
      setError((await focusDoneAction(id, !shown)).error)
    })

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={shown}
        aria-label={t('Done: {task}', { task: title })}
        onClick={toggle}
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-node-accent/40',
          shown ? 'border-success bg-success text-white' : 'border-input hover:border-node-accent',
        )}
      >
        {shown ? <Check className="size-4" aria-hidden="true" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] leading-snug', shown && 'text-muted-foreground line-through')}>{title}</p>
        {carried > 0 ? <p className="text-xs text-muted-foreground">{t.plural(carried, 'Carried {count} time', 'Carried {count} times')}</p> : null}
        <ErrorLine error={error} />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startPending(async () => setError((await removeFocusAction(id)).error))}
        aria-label={t('Remove {task}', { task: title })}
        className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}

export function CarryButton({ open }: { open: number }) {
  const t = useT()
  const { pending, error, act } = useOneTap()
  if (open === 0) return null
  return (
    <>
      <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => act(carryAction)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CornerDownRight aria-hidden="true" />}
        {t('Carry the rest to next week')}
      </Button>
      <ErrorLine error={error} />
    </>
  )
}

export function BringButton({ id }: { id: string }) {
  const t = useT()
  const { pending, error, act } = useOneTap()
  return (
    <>
      <Button type="button" variant="outline" className="h-9 text-xs" disabled={pending} onClick={() => act(() => bringAction(id))}>
        {t('Bring to this week')}
      </Button>
      <ErrorLine error={error} />
    </>
  )
}

const ALSO_LABELS: Record<(typeof LOG_ALSO)[number], string> = {
  none: m('Nothing else'),
  newFact: m('Add a fact'),
  endFact: m('A fact ended'),
  evidence: m('Add evidence to a fact'),
  move: m('Move an opportunity'),
}

// The quick log: a line, what it is about, and what else it records.
export function QuickLog({ goals, opportunities, facts }: { goals: Option[]; opportunities: Option[]; facts: { id: string; title: string }[] }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(writeLogAction, initialFormState)
  const [also, setAlso] = useState<(typeof LOG_ALSO)[number]>('none')
  const [status, setStatus] = useState<string>('APPLIED')
  const [formKey, setFormKey] = useState(0)
  const scope = 'log'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      formAction(formData)
    })
  }

  // A fresh form after each line written.
  const [lastSuccess, setLastSuccess] = useState(state)
  if (state !== lastSuccess) {
    setLastSuccess(state)
    if (state.status === 'success') {
      setFormKey((k) => k + 1)
      setAlso('none')
    }
  }

  return (
    <form key={formKey} onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4" noValidate>
      <Field state={state} name="body" label={t('A line about your career')} scope={scope}>
        <Textarea id={`${scope}-body`} {...fieldAttributes(state, 'body', scope)} maxLength={500} rows={2} placeholder={t('Passed AWS SAA today.')} />
      </Field>
      <GoalAndOpportunity state={state} scope={scope} goals={goals} opportunities={opportunities} />

      <Field state={state} name="also" label={t('And also')} scope={scope}>
        <NativeSelect id={`${scope}-also`} name="also" value={also} onChange={(e) => setAlso(e.target.value as typeof also)} className={FIELD_CLASS}>
          {LOG_ALSO.map((a) => (
            <NativeSelectOption key={a} value={a} disabled={(a === 'endFact' || a === 'evidence') && facts.length === 0 ? true : a === 'move' && opportunities.length === 0}>
              {t(ALSO_LABELS[a])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      {also === 'newFact' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field state={state} name="factKind" label={t('What it is')} scope={scope}>
            <NativeSelect id={`${scope}-factKind`} name="factKind" defaultValue="QUALIFICATION" className={FIELD_CLASS}>
              {FACT_KINDS.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {t(KIND_LABELS[k])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <TextField state={state} scope={scope} name="factTitle" label={t('Title')} maxLength={120} />
        </div>
      ) : null}

      {also === 'endFact' || also === 'evidence' ? (
        <Field state={state} name="factId" label={t('Which fact')} scope={scope}>
          <NativeSelect id={`${scope}-factId`} {...fieldAttributes(state, 'factId', scope)} defaultValue="" className={FIELD_CLASS}>
            <NativeSelectOption value="" disabled>
              {t('Choose')}
            </NativeSelectOption>
            {facts.map((f) => (
              <NativeSelectOption key={f.id} value={f.id}>
                {f.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}

      {also === 'evidence' ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField state={state} scope={scope} name="evidenceTitle" label={t('Evidence title')} maxLength={120} />
          <TextField state={state} scope={scope} name="evidenceUrl" label={t('Link (optional)')} type="url" maxLength={2000} />
        </div>
      ) : null}

      {also === 'move' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field state={state} name="moveOpportunityId" label={t('Which opportunity')} scope={scope}>
            <NativeSelect id={`${scope}-moveOpportunityId`} {...fieldAttributes(state, 'moveOpportunityId', scope)} defaultValue="" className={FIELD_CLASS}>
              <NativeSelectOption value="" disabled>
                {t('Choose')}
              </NativeSelectOption>
              {opportunities.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field state={state} name="status" label={t('Now')} scope={scope}>
            <NativeSelect id={`${scope}-status`} name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD_CLASS}>
              {OPPORTUNITY_STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {t(OPPORTUNITY_STATUS_LABELS[s])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {status === 'CLOSED' ? (
            <Field state={state} name="outcome" label={t('How it ended')} scope={scope}>
              <NativeSelect id={`${scope}-outcome`} name="outcome" defaultValue="" className={FIELD_CLASS}>
                <NativeSelectOption value="" disabled>
                  {t('Choose')}
                </NativeSelectOption>
                {OUTCOMES.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {t(OUTCOME_LABELS[o])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
        </div>
      ) : null}

      {state.formErrors[0] ? <p className="text-sm text-destructive-strong">{state.formErrors[0]}</p> : null}
      <Button type="submit" disabled={isPending} className="h-11">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {t('Log it')}
      </Button>
    </form>
  )
}
