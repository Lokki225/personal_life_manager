'use client'

import { startTransition, useActionState, useState, type ReactNode } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { deleteAllocationAction, deleteIncomeAction, saveAllocationAction, saveIncomeAction } from './actions'
import { ActionDrawer, ActionForm, AmountField, FIELD_CLASS } from './today-actions'

export type PlanAllocation = { id: string; name: string; amount: number; period: string; category: string }

// Removing asks once more in place, like deleting a chest.
function DeleteAllocation({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, isPending] = useActionState(async (previous: typeof initialFormState, formData: FormData) => {
    const next = await deleteAllocationAction(previous, formData)

    if (next.status === 'success') {
      onDone()
    }

    return next
  }, initialFormState)

  const submit = () => {
    const formData = new FormData()
    formData.set('id', id)
    startTransition(() => formAction(formData))
  }

  return (
    <div className="space-y-2 border-t px-4 pt-4 pb-6">
      {confirming ? (
        <>
          <p className="text-sm">{t('Delete this allocation? Your past expenses are kept.')}</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={isPending} onClick={submit} className="h-11 flex-1">
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {t('Delete')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="h-11 flex-1"
            >
              {t('Keep')}
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="h-11 w-full text-muted-foreground hover:text-destructive-strong"
        >
          <Trash2 aria-hidden="true" />
          {t('Delete this allocation')}
        </Button>
      )}
      {state.formErrors.length > 0 ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {state.formErrors[0]}
        </p>
      ) : null}
    </div>
  )
}

// Adds an allocation, or edits and deletes the one given.
function AllocationDrawer({ allocation, trigger }: { allocation?: PlanAllocation; trigger: ReactNode }) {
  const t = useT()
  const scope = allocation ? `allocation-${allocation.id}` : 'allocation-new'

  return (
    <ActionDrawer
      title={allocation ? t('Edit allocation') : t('New allocation')}
      description={t('Changes apply from today. Your chests follow: an allocation takes its money from the Base Chest.')}
      trigger={trigger}
    >
      {(close) => (
        <>
          <ActionForm action={saveAllocationAction} submitLabel={t('Save')} onDone={close}>
            {(state) => (
              <>
                {allocation ? <input type="hidden" name="id" value={allocation.id} /> : null}
                <div className="grid gap-2">
                  <Label htmlFor={`${scope}-name`}>{t('Name')}</Label>
                  <Input
                    id={`${scope}-name`}
                    {...fieldAttributes(state, 'name', scope)}
                    defaultValue={allocation?.name}
                    placeholder={t('Rent, internet, savings...')}
                    maxLength={60}
                    autoFocus={!allocation}
                    className={FIELD_CLASS}
                  />
                  <FieldError state={state} name="name" scope={scope} />
                </div>
                <AmountField state={state} scope={scope} defaultValue={allocation?.amount} autoFocus={false} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${scope}-period`}>{t('Period')}</Label>
                    <NativeSelect
                      id={`${scope}-period`}
                      {...fieldAttributes(state, 'period', scope)}
                      defaultValue={allocation?.period === 'weekly' ? 'weekly' : 'monthly'}
                      className={FIELD_CLASS}
                    >
                      <NativeSelectOption value="monthly">{t('Monthly')}</NativeSelectOption>
                      <NativeSelectOption value="weekly">{t('Weekly')}</NativeSelectOption>
                    </NativeSelect>
                    <FieldError state={state} name="period" scope={scope} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${scope}-category`}>{t('Category')}</Label>
                    <NativeSelect
                      id={`${scope}-category`}
                      {...fieldAttributes(state, 'category', scope)}
                      defaultValue={allocation?.category ?? 'fixed'}
                      className={FIELD_CLASS}
                    >
                      <NativeSelectOption value="fixed">{t('Fixed')}</NativeSelectOption>
                      <NativeSelectOption value="subscription">{t('Subscription')}</NativeSelectOption>
                      <NativeSelectOption value="daily_living">{t('Daily living')}</NativeSelectOption>
                      <NativeSelectOption value="savings">{t('Savings')}</NativeSelectOption>
                      <NativeSelectOption value="custom">{t('Custom')}</NativeSelectOption>
                    </NativeSelect>
                    <FieldError state={state} name="category" scope={scope} />
                  </div>
                </div>
              </>
            )}
          </ActionForm>
          {allocation ? <DeleteAllocation id={allocation.id} onDone={close} /> : null}
        </>
      )}
    </ActionDrawer>
  )
}

export function AddAllocationDrawer() {
  const t = useT()

  return (
    <AllocationDrawer
      trigger={
        <Button variant="outline" className="h-11 w-full">
          <Plus aria-hidden="true" />
          {t('Add allocation')}
        </Button>
      }
    />
  )
}

export function EditAllocationDrawer({ allocation }: { allocation: PlanAllocation }) {
  const t = useT()

  return (
    <AllocationDrawer
      allocation={allocation}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-11 shrink-0 text-muted-foreground"
          aria-label={t('Edit {name}', { name: allocation.name })}
        >
          <Pencil aria-hidden="true" />
        </Button>
      }
    />
  )
}

export type PlanIncome = { id: string; source: string; amount: number; payDay: number }

// Removing asks once more in place, like deleting an allocation.
function DeleteIncome({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, isPending] = useActionState(async (previous: typeof initialFormState, formData: FormData) => {
    const next = await deleteIncomeAction(previous, formData)

    if (next.status === 'success') {
      onDone()
    }

    return next
  }, initialFormState)

  const submit = () => {
    const formData = new FormData()
    formData.set('id', id)
    startTransition(() => formAction(formData))
  }

  return (
    <div className="space-y-2 border-t px-4 pt-4 pb-6">
      {confirming ? (
        <>
          <p className="text-sm">{t('Delete this income? Money it already put in your chests stays there.')}</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={isPending} onClick={submit} className="h-11 flex-1">
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {t('Delete')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="h-11 flex-1"
            >
              {t('Keep')}
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="h-11 w-full text-muted-foreground hover:text-destructive-strong"
        >
          <Trash2 aria-hidden="true" />
          {t('Delete this income')}
        </Button>
      )}
      {state.formErrors.length > 0 ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {state.formErrors[0]}
        </p>
      ) : null}
    </div>
  )
}

// Adds an income, or edits the one given. `canDelete` is false for the last
// income of a plan, which has to stay.
function IncomeDrawer({ income, canDelete = false, trigger }: { income?: PlanIncome; canDelete?: boolean; trigger: ReactNode }) {
  const t = useT()
  const scope = income ? `income-${income.id}` : 'income-new'

  return (
    <ActionDrawer
      title={income ? t('Edit income') : t('New income')}
      description={
        income
          ? t('It counts from the next time this income is confirmed.')
          : t('A pay day makes it part of your plan: it counts as received this month, and you confirm it from next month. Without one, it is money that came once, like a gift: it goes to your chests now.')
      }
      trigger={trigger}
    >
      {(close) => (
        <>
          <ActionForm action={saveIncomeAction} submitLabel={t('Save')} onDone={close}>
            {(state) => (
              <>
                {income ? <input type="hidden" name="id" value={income.id} /> : null}
                <div className="grid gap-2">
                  <Label htmlFor={`${scope}-source`}>{t('Source')}</Label>
                  <Input
                    id={`${scope}-source`}
                    {...fieldAttributes(state, 'source', scope)}
                    defaultValue={income?.source}
                    placeholder={t('Salary, rent received, side work...')}
                    maxLength={60}
                    autoFocus={!income}
                    className={FIELD_CLASS}
                  />
                  <FieldError state={state} name="source" scope={scope} />
                </div>
                <AmountField
                  state={state}
                  scope={scope}
                  label={t('Amount ({currency})', { currency: CURRENCY_CODE })}
                  defaultValue={income?.amount}
                  autoFocus={false}
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${scope}-payDay`}>
                    {income ? t('Pay day (day of the month)') : t('Pay day (day of the month, optional)')}
                  </Label>
                  <Input
                    id={`${scope}-payDay`}
                    {...fieldAttributes(state, 'payDay', scope)}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    defaultValue={income?.payDay ?? ''}
                    placeholder={income ? undefined : t('None: it came once')}
                    className={FIELD_CLASS}
                  />
                  <FieldError state={state} name="payDay" scope={scope} />
                </div>
              </>
            )}
          </ActionForm>
          {income && canDelete ? <DeleteIncome id={income.id} onDone={close} /> : null}
        </>
      )}
    </ActionDrawer>
  )
}

export function AddIncomeDrawer() {
  const t = useT()

  return (
    <IncomeDrawer
      trigger={
        <Button variant="outline" className="h-11 w-full">
          <Plus aria-hidden="true" />
          {t('Add income')}
        </Button>
      }
    />
  )
}

export function EditIncomeDrawer({ income, canDelete }: { income: PlanIncome; canDelete: boolean }) {
  const t = useT()

  return (
    <IncomeDrawer
      income={income}
      canDelete={canDelete}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-11 shrink-0 text-muted-foreground"
          aria-label={t('Edit {name}', { name: income.source })}
        >
          <Pencil aria-hidden="true" />
        </Button>
      }
    />
  )
}
