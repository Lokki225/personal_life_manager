'use client'

import { startTransition, useActionState, useState } from 'react'
import { LifeBuoy, Loader2, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { coverOverspendAction, deleteExpenseAction, editExpenseAction } from './actions'
import { ActionDrawer, ActionForm, AmountField, CategoryChips, FIELD_CLASS } from './today-actions'

export type TodayExpense = { id: string; amount: number; category: string; description: string | null }

// Deleting asks once more in place, since it cannot be undone.
function DeleteExpense({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const next = await deleteExpenseAction(previous, formData)

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
          <p className="text-sm">{t('Delete this expense? This cannot be undone.')}</p>
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
          {t('Delete this expense')}
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

// Corrects or deletes one of today's expenses.
export function EditExpenseDrawer({ expense, label }: { expense: TodayExpense; label: string }) {
  const t = useT()
  const scope = `expense-${expense.id}`

  return (
    <ActionDrawer
      title={t('Edit expense')}
      description={t('An expense can be corrected or deleted the day it was made.')}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-11 shrink-0 text-muted-foreground"
          aria-label={t('Edit {name}', { name: label })}
        >
          <Pencil aria-hidden="true" />
        </Button>
      }
    >
      {(close) => (
        <>
          <ActionForm action={editExpenseAction} submitLabel={t('Save')} onDone={close}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={expense.id} />
                <AmountField state={state} scope={scope} defaultValue={expense.amount} autoFocus={false} />
                <CategoryChips
                  categories={EXPENSE_CATEGORIES}
                  legend={t('Category')}
                  defaultValue={expense.category}
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${scope}-description`}>{t('Note (optional)')}</Label>
                  <Input
                    id={`${scope}-description`}
                    {...fieldAttributes(state, 'description', scope)}
                    defaultValue={expense.description ?? ''}
                    maxLength={80}
                    className={FIELD_CLASS}
                  />
                  <FieldError state={state} name="description" scope={scope} />
                </div>
              </>
            )}
          </ActionForm>
          <DeleteExpense id={expense.id} onDone={close} />
        </>
      )}
    </ActionDrawer>
  )
}

// One tap: today's overspend is paid out of the Buffer, as far as it goes.
export function CoverFromBufferButton({ amount }: { amount: number }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(coverOverspendAction, initialFormState)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => formAction(new FormData()))}
        className="h-auto min-h-12 w-full py-2 text-base whitespace-normal"
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LifeBuoy aria-hidden="true" />}
        {t('Cover {amount} {currency} from the Buffer', { amount, currency: CURRENCY_CODE })}
      </Button>
      {state.formErrors.length > 0 ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {state.formErrors[0]}
        </p>
      ) : null}
    </div>
  )
}
