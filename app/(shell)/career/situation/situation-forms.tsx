'use client'

import { startTransition, useActionState, useState, useTransition, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { CircleAlert, Link2, Loader2, Plus, Trash2, X } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CONTRACT_TYPES, FACT_KINDS, WORK_ARRANGEMENTS, type FactKind } from '@/domain/career/situation'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { ARRANGEMENT_LABELS, CONTRACT_LABELS, isoDay, KIND_HINTS, KIND_LABELS } from '../labels'
import {
  addEvidenceAction,
  deleteEvidenceAction,
  endFactAction,
  makePrimaryAction,
  markReviewedAction,
  saveFactAction,
  saveLocationsAction,
  unlinkEvidenceAction,
} from './actions'

// A fact as the forms need it: plain values, dates as YYYY-MM-DD.
export type FactValues = {
  id: string
  kind: FactKind
  title: string
  details: string | null
  validFrom: string
  validTo: string | null
  confirmed: boolean
  organisation: string | null
  monthlyCompensation: number | null
  workArrangement: string | null
  contractType: string | null
  weeklyHours: number | null
  location: string | null
  issuer: string | null
  obtainedAt: string | null
  expiresAt: string | null
  level: string | null
  positionId: string | null
}

type Option = { id: string; title: string }

// The journal's text area, in a smaller size.
function Textarea(props: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className="rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  )
}

function Field({ state, name, label, scope, children }: { state: FormState; name: string; label: string; scope: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${scope}-${name}`}>{label}</Label>
      {children}
      <FieldError state={state} name={name} scope={scope} />
    </div>
  )
}

function TextField({
  state,
  scope,
  name,
  label,
  defaultValue,
  type = 'text',
  maxLength,
  inputMode,
  list,
}: {
  state: FormState
  scope: string
  name: string
  label: string
  defaultValue?: string | number | null
  type?: string
  maxLength?: number
  inputMode?: 'numeric'
  list?: string
}) {
  return (
    <Field state={state} name={name} label={label} scope={scope}>
      <Input
        id={`${scope}-${name}`}
        {...fieldAttributes(state, name, scope)}
        type={type}
        defaultValue={defaultValue ?? ''}
        maxLength={maxLength}
        inputMode={inputMode}
        list={list}
        className={FIELD_CLASS}
      />
    </Field>
  )
}

// The fields of a fact; those of its kind only.
function FactFields({
  state,
  scope,
  kind,
  fact,
  positions,
  locations,
}: {
  state: FormState
  scope: string
  kind: FactKind
  fact?: FactValues
  positions: Option[]
  locations: string[]
}) {
  const t = useT()

  return (
    <>
      <TextField state={state} scope={scope} name="title" label={t('Title')} defaultValue={fact?.title} maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <TextField state={state} scope={scope} name="validFrom" label={t('Since')} type="date" defaultValue={fact?.validFrom ?? isoDay(new Date())} />
        <TextField state={state} scope={scope} name="validTo" label={t('Until (optional)')} type="date" defaultValue={fact?.validTo} />
      </div>

      {kind === 'POSITION' ? (
        <>
          <TextField state={state} scope={scope} name="organisation" label={t('Organisation')} defaultValue={fact?.organisation} maxLength={120} />
          <TextField
            state={state}
            scope={scope}
            name="monthlyCompensation"
            label={t('Pay per month ({currency})', { currency: CURRENCY_CODE })}
            defaultValue={fact?.monthlyCompensation}
            inputMode="numeric"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field state={state} name="workArrangement" label={t('How you work')} scope={scope}>
              <NativeSelect id={`${scope}-workArrangement`} {...fieldAttributes(state, 'workArrangement', scope)} defaultValue={fact?.workArrangement ?? ''} className={FIELD_CLASS}>
                <NativeSelectOption value="">{t('Not said')}</NativeSelectOption>
                {WORK_ARRANGEMENTS.map((a) => (
                  <NativeSelectOption key={a} value={a}>
                    {t(ARRANGEMENT_LABELS[a])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field state={state} name="contractType" label={t('Contract')} scope={scope}>
              <NativeSelect id={`${scope}-contractType`} {...fieldAttributes(state, 'contractType', scope)} defaultValue={fact?.contractType ?? ''} className={FIELD_CLASS}>
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
            <TextField state={state} scope={scope} name="weeklyHours" label={t('Hours per week')} defaultValue={fact?.weeklyHours} inputMode="numeric" />
            <TextField state={state} scope={scope} name="location" label={t('Place')} defaultValue={fact?.location} maxLength={60} list={`${scope}-places`} />
            <datalist id={`${scope}-places`}>
              {locations.map((place) => (
                <option key={place} value={place} />
              ))}
            </datalist>
          </div>
        </>
      ) : null}

      {kind === 'QUALIFICATION' ? (
        <>
          <TextField state={state} scope={scope} name="issuer" label={t('Issued by')} defaultValue={fact?.issuer} maxLength={120} />
          <div className="grid grid-cols-2 gap-3">
            <TextField state={state} scope={scope} name="obtainedAt" label={t('Obtained')} type="date" defaultValue={fact?.obtainedAt} />
            <TextField state={state} scope={scope} name="expiresAt" label={t('Expires (optional)')} type="date" defaultValue={fact?.expiresAt} />
          </div>
        </>
      ) : null}

      {kind === 'SKILL' ? (
        <TextField state={state} scope={scope} name="level" label={t('Your level, in your words')} defaultValue={fact?.level} maxLength={60} />
      ) : null}

      {kind === 'EXPERIENCE' ? (
        <Field state={state} name="positionId" label={t('In which position (optional)')} scope={scope}>
          <NativeSelect id={`${scope}-positionId`} {...fieldAttributes(state, 'positionId', scope)} defaultValue={fact?.positionId ?? ''} className={FIELD_CLASS}>
            <NativeSelectOption value="">{t('None')}</NativeSelectOption>
            {positions
              .filter((p) => p.id !== fact?.id)
              .map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.title}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>
      ) : null}

      <Field state={state} name="details" label={kind === 'EXPERIENCE' ? t('What came of it (optional)') : t('Details (optional)')} scope={scope}>
        <Textarea id={`${scope}-details`} {...fieldAttributes(state, 'details', scope)} defaultValue={fact?.details ?? ''} maxLength={1000} rows={3} />
      </Field>
    </>
  )
}

export function AddFactDrawer({ positions, locations }: { positions: Option[]; locations: string[] }) {
  const t = useT()
  const [kind, setKind] = useState<FactKind>('POSITION')
  const scope = 'add-fact'

  return (
    <ActionDrawer
      title={t('Add a fact')}
      description={t('Something true about your professional life, from a date.')}
      trigger={
        <Button type="button" className="h-11">
          <Plus aria-hidden="true" />
          {t('Add a fact')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={saveFactAction} submitLabel={t('Add')} onDone={close}>
          {(state) => (
            <>
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">{t('What is it?')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {FACT_KINDS.map((k) => (
                    <label key={k} className="cursor-pointer">
                      <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
                      <span className="block rounded-lg border border-input px-3 py-2 text-sm transition-colors peer-checked:border-node-accent peer-checked:bg-node-accent/10 peer-focus-visible:ring-[3px] peer-focus-visible:ring-node-accent/40">
                        {t(KIND_LABELS[k])}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t(KIND_HINTS[kind])}</p>
              </fieldset>
              <FactFields state={state} scope={scope} kind={kind} positions={positions} locations={locations} />
              {kind === 'POSITION' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="primary" className="size-4 accent-node-accent" />
                  {t('This is my main position')}
                </label>
              ) : null}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function EditFactDrawer({ fact, positions, locations }: { fact: FactValues; positions: Option[]; locations: string[] }) {
  const t = useT()
  const scope = `edit-${fact.id}`

  return (
    <ActionDrawer
      title={t('Edit')}
      description={t(KIND_LABELS[fact.kind])}
      trigger={
        <Button type="button" variant="ghost" className="h-9 text-xs">
          {t('Edit')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={saveFactAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={fact.id} />
              <input type="hidden" name="kind" value={fact.kind} />
              <FactFields state={state} scope={scope} kind={fact.kind} fact={fact} positions={positions} locations={locations} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirmed" defaultChecked={fact.confirmed} className="mt-0.5 size-4 accent-node-accent" />
                {t('I checked this myself: mark it confirmed, even without evidence')}
              </label>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function EndFactDrawer({ factId, title }: { factId: string; title: string }) {
  const t = useT()
  const scope = `end-${factId}`

  return (
    <ActionDrawer
      title={t('No longer true')}
      description={t('{fact} is kept in your history, with its end date.', { fact: title })}
      trigger={
        <Button type="button" variant="ghost" className="h-9 text-xs">
          {t('End')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={endFactAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={factId} />
              <TextField state={state} scope={scope} name="validTo" label={t('Ended on')} type="date" defaultValue={isoDay(new Date())} />
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
    <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive-strong">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null
}

// The one-tap actions of a fact: mark it reviewed, make a position the main one.
export function FactQuickActions({ factId, canBePrimary, reviewDue }: { factId: string; canBePrimary: boolean; reviewDue: boolean }) {
  const t = useT()
  const { pending, error, act } = useOneTap()

  return (
    <>
      <Button
        type="button"
        variant={reviewDue ? 'outline' : 'ghost'}
        className="h-9 text-xs"
        disabled={pending}
        onClick={() => act(() => markReviewedAction(factId))}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {t('Mark as reviewed')}
      </Button>
      {canBePrimary ? (
        <Button type="button" variant="ghost" className="h-9 text-xs" disabled={pending} onClick={() => act(() => makePrimaryAction(factId))}>
          {t('Make it my main position')}
        </Button>
      ) : null}
      <ErrorLine error={error} />
    </>
  )
}

export function AddEvidenceDrawer({ facts }: { facts: Option[] }) {
  const t = useT()
  const scope = 'evidence'

  return (
    <ActionDrawer
      title={t('Add evidence')}
      description={t('A link that shows it: a certificate, a repository, a portfolio, an article.')}
      trigger={
        <Button type="button" variant="outline" className="h-11">
          <Link2 aria-hidden="true" />
          {t('Add evidence')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={addEvidenceAction} submitLabel={t('Add')} onDone={close}>
          {(state) => (
            <>
              <TextField state={state} scope={scope} name="title" label={t('Title')} maxLength={120} />
              <TextField state={state} scope={scope} name="url" label={t('Link (optional)')} type="url" maxLength={2000} />
              <Field state={state} name="description" label={t('What it shows (optional)')} scope={scope}>
                <Textarea id={`${scope}-description`} {...fieldAttributes(state, 'description', scope)} maxLength={1000} rows={2} />
              </Field>
              {facts.length > 0 ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">{t('It supports')}</legend>
                  {facts.map((fact) => (
                    <label key={fact.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`facts.${fact.id}`} className="size-4 accent-node-accent" />
                      {fact.title}
                    </label>
                  ))}
                  <FieldError state={state} name="factIds" scope={scope} />
                </fieldset>
              ) : null}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

// An evidence item's actions: unlink it from one fact, or delete it.
export function UnlinkButton({ evidenceId, factId, title }: { evidenceId: string; factId: string; title: string }) {
  const t = useT()
  const { pending, error, act } = useOneTap()

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      {title}
      <button
        type="button"
        disabled={pending}
        onClick={() => act(() => unlinkEvidenceAction(evidenceId, factId))}
        aria-label={t('Unlink from {fact}', { fact: title })}
        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
      <ErrorLine error={error} />
    </span>
  )
}

export function DeleteEvidenceButton({ evidenceId }: { evidenceId: string }) {
  const t = useT()
  const { pending, error, act } = useOneTap()

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-xs text-muted-foreground"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t('Delete this evidence? The facts it supports stay.'))) act(() => deleteEvidenceAction(evidenceId))
        }}
      >
        <Trash2 aria-hidden="true" />
        {t('Delete')}
      </Button>
      <ErrorLine error={error} />
    </>
  )
}

// The places a "location" criterion can accept, one per line.
export function LocationsForm({ places }: { places: string[] }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(saveLocationsAction, initialFormState)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor="places-places">{t('Your places, one per line')}</Label>
      <Textarea
        id="places-places"
        {...fieldAttributes(state, 'places', 'places')}
        defaultValue={places.join('\n')}
        rows={3}
        placeholder={t('Abidjan')}
      />
      <FieldError state={state} name="places" scope="places" />
      <FieldError state={state} name="locations" scope="places" />
      {state.formErrors[0] ? <p className="text-sm text-destructive-strong">{state.formErrors[0]}</p> : null}
      <Button type="submit" variant="outline" disabled={isPending} className="h-10">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {state.status === 'success' && !isPending ? t('Saved.') : t('Save')}
      </Button>
    </form>
  )
}
