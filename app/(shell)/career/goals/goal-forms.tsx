'use client'

import { useState, useTransition } from 'react'
import { CircleAlert, Loader2, Plus } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { choicesFor, LEVELS, type ChoiceDimension } from '@/domain/career/criteria'
import { FACT_KINDS } from '@/domain/career/situation'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import type { GoalStatus } from '@/domain/goals/status'
import { fieldAttributes } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { Field, Textarea, TextField } from '../fields'
import {
  CRITERION_KIND_HINTS,
  CRITERION_KIND_LABELS,
  DIMENSION_LABELS,
  IMPORTANCE_LABELS,
  KIND_LABELS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  OPERATOR_LABELS,
  RESULT_LABELS,
} from '../labels'
import {
  abandonGoalAction,
  addCriterionAction,
  goalStateAction,
  judgeAction,
  markCriterionReviewedAction,
  removeCriterionAction,
  saveGoalAction,
  supersedeGoalAction,
} from './actions'
import { choiceLabel } from './goal-text'

export type GoalValues = { id: string; name: string; why: string | null; deadline: string | null; importance: 'LOW' | 'MEDIUM' | 'HIGH' | null }

// A choice among large tap targets, styled like the other Career forms.
function Choices<V extends string>({ name, values, value, onChange, label }: { name: string; values: readonly V[]; value: V; onChange: (v: V) => void; label: (v: V) => string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {values.map((v) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
          <span className="block rounded-lg border border-input px-3 py-2 text-sm transition-colors peer-checked:border-node-accent peer-checked:bg-node-accent/10 peer-focus-visible:ring-[3px] peer-focus-visible:ring-node-accent/40">
            {label(v)}
          </span>
        </label>
      ))}
    </div>
  )
}

export function GoalDrawer({ goal }: { goal?: GoalValues }) {
  const t = useT()
  const scope = goal ? `goal-${goal.id}` : 'new-goal'

  return (
    <ActionDrawer
      title={goal ? t('Edit the goal') : t('A new goal')}
      description={t('What you want next, in your words. You add its criteria on its page.')}
      trigger={
        goal ? (
          <Button type="button" variant="ghost" className="h-9 text-xs">
            {t('Edit')}
          </Button>
        ) : (
          <Button type="button" className="h-11">
            <Plus aria-hidden="true" />
            {t('New goal')}
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveGoalAction} submitLabel={goal ? t('Save') : t('Create')} onDone={close}>
          {(state) => (
            <>
              {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
              <TextField state={state} scope={scope} name="name" label={t('What you want')} defaultValue={goal?.name} maxLength={120} />
              <Field state={state} name="why" label={t('Why it matters (optional)')} scope={scope}>
                <Textarea id={`${scope}-why`} {...fieldAttributes(state, 'why', scope)} defaultValue={goal?.why ?? ''} maxLength={1000} rows={3} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <TextField state={state} scope={scope} name="deadline" label={t('By (optional)')} type="date" defaultValue={goal?.deadline} />
                <Field state={state} name="importance" label={t('How much it matters')} scope={scope}>
                  <NativeSelect id={`${scope}-importance`} {...fieldAttributes(state, 'importance', scope)} defaultValue={goal?.importance ?? ''} className={FIELD_CLASS}>
                    <NativeSelectOption value="">{t('Not said')}</NativeSelectOption>
                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map((i) => (
                      <NativeSelectOption key={i} value={i}>
                        {t(IMPORTANCE_LABELS[i])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

const CRITERION_KINDS = ['number', 'choice', 'evidence', 'judgement'] as const

export function AddCriterionDrawer({ goalId, places }: { goalId: string; places: string[] }) {
  const t = useT()
  const [kind, setKind] = useState<(typeof CRITERION_KINDS)[number]>('number')
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('REQUIRED')
  const [dimension, setDimension] = useState<ChoiceDimension>('work_arrangement')
  const scope = `criterion-${goalId}`
  const choices = choicesFor(dimension, places)

  return (
    <ActionDrawer
      title={t('Add a criterion')}
      description={t('What "better" means for this goal, in your own terms.')}
      trigger={
        <Button type="button" variant="outline" className="h-10">
          <Plus aria-hidden="true" />
          {t('Add a criterion')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={addCriterionAction} submitLabel={t('Add')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="goalId" value={goalId} />
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">{t('What kind?')}</legend>
                <Choices name="kind" values={CRITERION_KINDS} value={kind} onChange={setKind} label={(k) => t(CRITERION_KIND_LABELS[k])} />
                <p className="text-xs text-muted-foreground">{t(CRITERION_KIND_HINTS[kind])}</p>
              </fieldset>

              {kind === 'number' ? (
                <>
                  <Field state={state} name="numberDimension" label={t('What')} scope={scope}>
                    <NativeSelect id={`${scope}-numberDimension`} name="numberDimension" className={FIELD_CLASS}>
                      <NativeSelectOption value="monthly_compensation">{t(DIMENSION_LABELS.monthly_compensation)}</NativeSelectOption>
                      <NativeSelectOption value="weekly_hours">{t(DIMENSION_LABELS.weekly_hours)}</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field state={state} name="operator" label={t('Compared')} scope={scope}>
                      <NativeSelect id={`${scope}-operator`} name="operator" className={FIELD_CLASS}>
                        {(['GTE', 'LTE', 'EQ'] as const).map((o) => (
                          <NativeSelectOption key={o} value={o}>
                            {t(OPERATOR_LABELS[o])}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <TextField state={state} scope={scope} name="target" label={t('Target ({unit})', { unit: `${CURRENCY_CODE} / h` })} inputMode="numeric" />
                  </div>
                </>
              ) : null}

              {kind === 'choice' ? (
                <>
                  <Field state={state} name="choiceDimension" label={t('What')} scope={scope}>
                    <NativeSelect
                      id={`${scope}-choiceDimension`}
                      name="choiceDimension"
                      value={dimension}
                      onChange={(event) => setDimension(event.target.value as ChoiceDimension)}
                      className={FIELD_CLASS}
                    >
                      {(['work_arrangement', 'contract_type', 'location'] as const).map((d) => (
                        <NativeSelectOption key={d} value={d}>
                          {t(DIMENSION_LABELS[d])}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-sm font-medium">{t('Accepted')}</legend>
                    {choices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('Add your places on the Situation page first.')}</p>
                    ) : (
                      choices.map((value) => (
                        <label key={value} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name={`accepted.${value}`} className="size-4 accent-node-accent" />
                          {choiceLabel(t, value)}
                        </label>
                      ))
                    )}
                    <FieldError state={state} name="accepted" scope={scope} />
                  </fieldset>
                </>
              ) : null}

              {kind === 'evidence' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field state={state} name="factKind" label={t('Kind')} scope={scope}>
                    <NativeSelect id={`${scope}-factKind`} name="factKind" defaultValue="SKILL" className={FIELD_CLASS}>
                      {FACT_KINDS.filter((k) => k !== 'POSITION').map((k) => (
                        <NativeSelectOption key={k} value={k}>
                          {t(KIND_LABELS[k])}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <TextField state={state} scope={scope} name="match" label={t('Its title')} maxLength={120} />
                </div>
              ) : null}

              {kind === 'judgement' ? (
                <TextField state={state} scope={scope} name="label" label={t('What you will judge')} maxLength={160} />
              ) : null}

              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">{t('How much it counts')}</legend>
                <Choices name="level" values={LEVELS} value={level} onChange={setLevel} label={(l) => t(LEVEL_LABELS[l])} />
                <p className="text-xs text-muted-foreground">{t(LEVEL_HINTS[level])}</p>
              </fieldset>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function JudgeDrawer({ conditionId, label, again, opportunityId }: { conditionId: string; label: string; again: boolean; opportunityId?: string }) {
  const t = useT()
  const [result, setResult] = useState<'MET' | 'GAP' | 'UNKNOWN'>('MET')
  const scope = `judge-${conditionId}`

  return (
    <ActionDrawer
      title={again ? t('Judge again') : t('Judge now')}
      description={label}
      trigger={
        <Button type="button" variant="outline" className="h-9 text-xs">
          {again ? t('Judge again') : t('Judge now')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={judgeAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="conditionId" value={conditionId} />
              {opportunityId ? <input type="hidden" name="opportunityId" value={opportunityId} /> : null}
              <Choices name="result" values={['MET', 'GAP', 'UNKNOWN'] as const} value={result} onChange={setResult} label={(r) => t(RESULT_LABELS[r])} />
              <Field state={state} name="note" label={t('Note (optional)')} scope={scope}>
                <Textarea id={`${scope}-note`} {...fieldAttributes(state, 'note', scope)} maxLength={280} rows={2} />
              </Field>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

function useOneTap() {
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const act = (action: () => Promise<{ error: string | null }>) => startPending(async () => setError((await action()).error))
  return { pending, error, act }
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="flex w-full items-center gap-1.5 text-xs text-destructive-strong">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null
}

export function CriterionActions({ goalId, conditionId, canReview }: { goalId: string; conditionId: string; canReview: boolean }) {
  const t = useT()
  const { pending, error, act } = useOneTap()

  return (
    <>
      {canReview ? (
        <Button type="button" variant="outline" className="h-9 text-xs" disabled={pending} onClick={() => act(() => markCriterionReviewedAction(conditionId))}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {t('Mark as reviewed')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-xs text-muted-foreground"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t('Remove this criterion? Its judgements go with it.'))) act(() => removeCriterionAction(goalId, conditionId))
        }}
      >
        {t('Remove')}
      </Button>
      <ErrorLine error={error} />
    </>
  )
}

// What the person can do with the goal as it stands.
export function GoalStateActions({ goalId, status, others }: { goalId: string; status: GoalStatus; others: { id: string; name: string }[] }) {
  const t = useT()
  const { pending, error, act } = useOneTap()
  const closed = status === 'ACHIEVED' || status === 'ABANDONED' || status === 'SUPERSEDED'
  const tap = (change: 'confirm' | 'reopen' | 'pause' | 'resume') => act(() => goalStateAction(goalId, change))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {closed ? (
        <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={() => tap('reopen')}>
          {t('Reopen')}
        </Button>
      ) : (
        <>
          <Button type="button" variant={status === 'CRITERIA_MET' ? 'default' : 'outline'} className="h-10" disabled={pending} onClick={() => tap('confirm')}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {t('Mark achieved')}
          </Button>
          <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => tap(status === 'PAUSED' ? 'resume' : 'pause')}>
            {status === 'PAUSED' ? t('Resume') : t('Pause')}
          </Button>
          {others.length > 0 ? <SupersedeDrawer goalId={goalId} others={others} /> : null}
          <AbandonDrawer goalId={goalId} />
        </>
      )}
      <ErrorLine error={error} />
    </div>
  )
}

function AbandonDrawer({ goalId }: { goalId: string }) {
  const t = useT()
  const scope = `abandon-${goalId}`

  return (
    <ActionDrawer
      title={t('Let this goal go')}
      description={t('It stays in your list, marked abandoned. Nothing is lost.')}
      trigger={
        <Button type="button" variant="ghost" className="h-10 text-muted-foreground">
          {t('Abandon')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={abandonGoalAction} submitLabel={t('Abandon')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={goalId} />
              <Field state={state} name="reason" label={t('Why (optional)')} scope={scope}>
                <Textarea id={`${scope}-reason`} {...fieldAttributes(state, 'reason', scope)} maxLength={280} rows={2} />
              </Field>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

function SupersedeDrawer({ goalId, others }: { goalId: string; others: { id: string; name: string }[] }) {
  const t = useT()
  const scope = `supersede-${goalId}`

  return (
    <ActionDrawer
      title={t('Replaced by another goal')}
      description={t('Kept in your history, never counted as a failure.')}
      trigger={
        <Button type="button" variant="ghost" className="h-10">
          {t('Replace')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={supersedeGoalAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={goalId} />
              <Field state={state} name="byId" label={t('Replaced by')} scope={scope}>
                <NativeSelect id={`${scope}-byId`} {...fieldAttributes(state, 'byId', scope)} defaultValue="" className={FIELD_CLASS}>
                  <NativeSelectOption value="" disabled>
                    {t('Choose a goal')}
                  </NativeSelectOption>
                  {others.map((g) => (
                    <NativeSelectOption key={g.id} value={g.id}>
                      {g.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
