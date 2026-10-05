'use client'

import { useState, useTransition } from 'react'
import { CircleAlert, Handshake, Plus, Trash2 } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { OPPORTUNITY_KINDS, OPPORTUNITY_STATUSES, OUTCOMES, type OpportunityKind, type OpportunityStatus } from '@/domain/career/opportunities'
import { CONTRACT_TYPES, WORK_ARRANGEMENTS } from '@/domain/career/situation'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { fieldAttributes } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { Field, Textarea, TextField } from '../fields'
import { ARRANGEMENT_LABELS, CONTRACT_LABELS, isoDay, OPPORTUNITY_KIND_LABELS, OPPORTUNITY_STATUS_LABELS, OUTCOME_LABELS } from '../labels'
import { acceptOfferAction, deleteOpportunityAction, linkGoalsAction, moveOpportunityAction, saveOpportunityAction } from './actions'

export type OpportunityValues = {
  id: string
  title: string
  organisation: string | null
  kind: OpportunityKind
  sourceUrl: string | null
  notes: string | null
  deadline: string | null
  monthlyCompensation: number | null
  workArrangement: string | null
  contractType: string | null
  weeklyHours: number | null
  location: string | null
}

type GoalOption = { id: string; name: string; linked?: boolean }

function GoalCheckboxes({ goals, legend }: { goals: GoalOption[]; legend: string }) {
  return goals.length > 0 ? (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {goals.map((goal) => (
        <label key={goal.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={`goals.${goal.id}`} defaultChecked={goal.linked} className="size-4 accent-node-accent" />
          {goal.name}
        </label>
      ))}
    </fieldset>
  ) : null
}

export function OpportunityDrawer({ opportunity, goals, places }: { opportunity?: OpportunityValues; goals: GoalOption[]; places: string[] }) {
  const t = useT()
  const scope = opportunity ? `opportunity-${opportunity.id}` : 'new-opportunity'
  const o = opportunity

  return (
    <ActionDrawer
      title={o ? t('Edit the opportunity') : t('A new opportunity')}
      description={t('An opening or an offer, with its terms as far as you know them.')}
      trigger={
        o ? (
          <Button type="button" variant="ghost" className="h-9 text-xs">
            {t('Edit')}
          </Button>
        ) : (
          <Button type="button" className="h-11">
            <Plus aria-hidden="true" />
            {t('New opportunity')}
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveOpportunityAction} submitLabel={o ? t('Save') : t('Add')} onDone={close}>
          {(state) => (
            <>
              {o ? <input type="hidden" name="id" value={o.id} /> : null}
              <TextField state={state} scope={scope} name="title" label={t('Title')} defaultValue={o?.title} maxLength={120} />
              <div className="grid grid-cols-2 gap-3">
                <TextField state={state} scope={scope} name="organisation" label={t('Organisation')} defaultValue={o?.organisation} maxLength={120} />
                <Field state={state} name="kind" label={t('What it is')} scope={scope}>
                  <NativeSelect id={`${scope}-kind`} {...fieldAttributes(state, 'kind', scope)} defaultValue={o?.kind ?? 'JOB'} className={FIELD_CLASS}>
                    {OPPORTUNITY_KINDS.map((k) => (
                      <NativeSelectOption key={k} value={k}>
                        {t(OPPORTUNITY_KIND_LABELS[k])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <TextField state={state} scope={scope} name="sourceUrl" label={t('Link (optional)')} type="url" defaultValue={o?.sourceUrl} maxLength={2000} />
              <TextField state={state} scope={scope} name="deadline" label={t('Deadline (optional)')} type="date" defaultValue={o?.deadline} />

              <fieldset className="grid gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">{t('Terms (optional)')}</legend>
                <TextField
                  state={state}
                  scope={scope}
                  name="monthlyCompensation"
                  label={t('Pay per month ({currency})', { currency: CURRENCY_CODE })}
                  defaultValue={o?.monthlyCompensation}
                  inputMode="numeric"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field state={state} name="workArrangement" label={t('How you work')} scope={scope}>
                    <NativeSelect id={`${scope}-workArrangement`} {...fieldAttributes(state, 'workArrangement', scope)} defaultValue={o?.workArrangement ?? ''} className={FIELD_CLASS}>
                      <NativeSelectOption value="">{t('Not said')}</NativeSelectOption>
                      {WORK_ARRANGEMENTS.map((a) => (
                        <NativeSelectOption key={a} value={a}>
                          {t(ARRANGEMENT_LABELS[a])}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field state={state} name="contractType" label={t('Contract')} scope={scope}>
                    <NativeSelect id={`${scope}-contractType`} {...fieldAttributes(state, 'contractType', scope)} defaultValue={o?.contractType ?? ''} className={FIELD_CLASS}>
                      <NativeSelectOption value="">{t('Not said')}</NativeSelectOption>
                      {CONTRACT_TYPES.map((c) => (
                        <NativeSelectOption key={c} value={c}>
                          {t(CONTRACT_LABELS[c])}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField state={state} scope={scope} name="weeklyHours" label={t('Hours per week')} defaultValue={o?.weeklyHours} inputMode="numeric" />
                  <TextField state={state} scope={scope} name="location" label={t('Place')} defaultValue={o?.location} maxLength={60} list={`${scope}-places`} />
                  <datalist id={`${scope}-places`}>
                    {places.map((place) => (
                      <option key={place} value={place} />
                    ))}
                  </datalist>
                </div>
              </fieldset>

              <Field state={state} name="notes" label={t('Notes (optional)')} scope={scope}>
                <Textarea id={`${scope}-notes`} {...fieldAttributes(state, 'notes', scope)} defaultValue={o?.notes ?? ''} maxLength={2000} rows={3} />
              </Field>
              {o ? null : <GoalCheckboxes goals={goals} legend={t('Compare it with')} />}
              <FieldError state={state} name="goalIds" scope={scope} />
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function MoveDrawer({ id, status }: { id: string; status: OpportunityStatus }) {
  const t = useT()
  const [next, setNext] = useState<OpportunityStatus>(status === 'CLOSED' ? 'CLOSED' : (OPPORTUNITY_STATUSES[OPPORTUNITY_STATUSES.indexOf(status) + 1] ?? 'CLOSED'))
  const scope = `move-${id}`

  return (
    <ActionDrawer
      title={t('Where it stands')}
      description={t('Moving it keeps the history of each step.')}
      trigger={
        <Button type="button" variant="outline" className="h-10">
          {t('Move')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={moveOpportunityAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={id} />
              <Field state={state} name="status" label={t('Status')} scope={scope}>
                <NativeSelect id={`${scope}-status`} name="status" value={next} onChange={(e) => setNext(e.target.value as OpportunityStatus)} className={FIELD_CLASS}>
                  {OPPORTUNITY_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {t(OPPORTUNITY_STATUS_LABELS[s])}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {next === 'CLOSED' ? (
                <Field state={state} name="outcome" label={t('How it ended')} scope={scope}>
                  <NativeSelect id={`${scope}-outcome`} {...fieldAttributes(state, 'outcome', scope)} defaultValue="" className={FIELD_CLASS}>
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
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function LinkGoalsDrawer({ id, goals }: { id: string; goals: GoalOption[] }) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('Compare with goals')}
      description={t('Each goal you choose shows this opportunity next to your situation.')}
      trigger={
        <Button type="button" variant="ghost" className="h-10">
          {t('Goals')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={linkGoalsAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={id} />
              {goals.length === 0 ? <p className="text-sm text-muted-foreground">{t('Create a goal first.')}</p> : <GoalCheckboxes goals={goals} legend={t('Goals')} />}
              <FieldError state={state} name="goalIds" scope={`link-${id}`} />
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function AcceptOfferDrawer({
  id,
  title,
  currentPosition,
  incomes,
}: {
  id: string
  title: string
  currentPosition: string | null
  incomes: { id: string; source: string; amount: number }[]
}) {
  const t = useT()
  const scope = `accept-${id}`
  const box = 'mt-0.5 size-4 accent-node-accent'

  return (
    <ActionDrawer
      title={t('Accept the offer')}
      description={t('{offer} becomes your situation. Choose what follows.', { offer: title })}
      trigger={
        <Button type="button" className="h-10">
          <Handshake aria-hidden="true" />
          {t('Accept')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={acceptOfferAction} submitLabel={t('Accept')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={id} />
              <TextField state={state} scope={scope} name="startsOn" label={t('Starts on')} type="date" defaultValue={isoDay(new Date())} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="createPosition" defaultChecked className={box} />
                {t('Create the new position from its terms, as my main one')}
              </label>
              {currentPosition ? (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="endCurrent" defaultChecked className={box} />
                  {t('End {position} that day', { position: currentPosition })}
                </label>
              ) : null}
              {incomes.length > 0 ? (
                <Field state={state} name="incomeId" label={t('Its pay is this Finance income (optional)')} scope={scope}>
                  <NativeSelect id={`${scope}-incomeId`} {...fieldAttributes(state, 'incomeId', scope)} defaultValue="" className={FIELD_CLASS}>
                    <NativeSelectOption value="">{t('None')}</NativeSelectOption>
                    {incomes.map((income) => (
                      <NativeSelectOption key={income.id} value={income.id}>
                        {income.source}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="copyJudgements" defaultChecked className={box} />
                {t('Keep my judgements of this offer as judgements of my situation')}
              </label>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function DeleteOpportunityButton({ id }: { id: string }) {
  const t = useT()
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-10 text-muted-foreground"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t('Delete this opportunity and your judgements of it?'))) {
            startPending(async () => setError((await deleteOpportunityAction(id)).error))
          }
        }}
      >
        <Trash2 aria-hidden="true" />
        {t('Delete')}
      </Button>
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive-strong">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </>
  )
}
