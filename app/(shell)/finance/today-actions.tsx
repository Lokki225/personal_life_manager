'use client'

import { useState } from 'react'
import {
  BanknoteArrowDown,
  MessageSquareWarning,
  PiggyBank,
  Plus,
  TriangleAlert,
} from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { fieldAttributes, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { addExpense, confirmIncomeAction, recordException, saveRemaining } from './actions'
import { categoryStyle } from './categories'

// Shared with the other nodes; still exported from here for Finance.
export { ActionDrawer, ActionForm, FIELD_CLASS }

export function AmountField({
  state,
  scope,
  name = 'amount',
  label,
  defaultValue,
  autoFocus = true,
  onValueChange,
}: {
  state: FormState
  scope: string
  name?: string
  // Defaults to "Amount (XOF)".
  label?: string
  defaultValue?: number
  autoFocus?: boolean
  // Told the amount as it is typed.
  onValueChange?: (value: number) => void
}) {
  const t = useT()

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${scope}-${name}`}>{label ?? t('Amount ({currency})', { currency: CURRENCY_CODE })}</Label>
      <Input
        id={`${scope}-${name}`}
        {...fieldAttributes(state, name, scope)}
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={defaultValue}
        onChange={onValueChange ? (event) => onValueChange(Number(event.target.value) || 0) : undefined}
        placeholder="0"
        autoFocus={autoFocus}
        className={`${FIELD_CLASS} text-lg font-semibold`}
      />
      <FieldError state={state} name={name} scope={scope} />
    </div>
  )
}

// Category choices as large tap targets instead of a dropdown.
export function CategoryChips({
  categories,
  legend,
  name = 'category',
  defaultValue,
}: {
  categories: readonly string[]
  legend: string
  name?: string
  // The choice to start on. The first one unless said otherwise.
  defaultValue?: string
}) {
  const t = useT()

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category, index) => {
          const { label, icon: Icon } = categoryStyle(category)

          return (
            <label key={category} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={category}
                defaultChecked={defaultValue && categories.includes(defaultValue) ? category === defaultValue : index === 0}
                className="peer sr-only"
              />
              <span className="flex h-12 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                <Icon className="size-4" aria-hidden="true" />
                {t(label)}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

// A chest that can pay for an expense now: it holds money and is not locked.
export type PayingChest = { id: string; name: string; balance: number }

// The fields of an expense. When the amount is larger than what is left of
// the day, the expense is an exception, and its cause is asked right here.
// Paid from a chest, it leaves the day alone and cannot go over it.
function ExpenseFields({
  state,
  left,
  hasBudget,
  chests,
}: {
  state: FormState
  left: number
  hasBudget: boolean
  chests: PayingChest[]
}) {
  const t = useT()
  const scope = 'expense'
  const [amount, setAmount] = useState(0)
  const [chestId, setChestId] = useState('')
  const chest = chests.find((candidate) => candidate.id === chestId)
  const over = hasBudget && !chest ? Math.max(amount - left, 0) : 0

  return (
    <>
      <AmountField state={state} scope={scope} onValueChange={setAmount} />
      <CategoryChips categories={EXPENSE_CATEGORIES} legend={t('Category')} />
      <div className="grid gap-2">
        <Label htmlFor="expense-description">{t('Note (optional)')}</Label>
        <Input
          id="expense-description"
          {...fieldAttributes(state, 'description', scope)}
          placeholder={t('Lunch, taxi...')}
          maxLength={80}
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="description" scope={scope} />
      </div>

      {chests.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="expense-chest">{t('Paid with')}</Label>
          <NativeSelect
            id="expense-chest"
            {...fieldAttributes(state, 'chestId', scope)}
            value={chestId}
            onChange={(event) => setChestId(event.target.value)}
            className={FIELD_CLASS}
          >
            <NativeSelectOption value="">{t("Today's budget")}</NativeSelectOption>
            {chests.map((candidate) => (
              <NativeSelectOption key={candidate.id} value={candidate.id}>
                {t(candidate.name)} · {t.amount(candidate.balance)} {CURRENCY_CODE}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {chest ? (
            <p className="text-sm text-muted-foreground">
              {t("The money leaves {chest} now. Today's budget stays as it is.", { chest: t(chest.name) })}
            </p>
          ) : null}
          <FieldError state={state} name="chestId" scope={scope} />
        </div>
      ) : null}

      {over > 0 ? (
        <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {t('This is {amount} {currency} more than what is left today. It will be recorded as an exception.', {
              amount: over,
              currency: CURRENCY_CODE,
            })}
          </p>
          <CategoryChips categories={EXCEPTION_CATEGORIES} legend={t('What caused it?')} name="cause" />
          <FieldError state={state} name="cause" scope={scope} />
          <div className="grid gap-2">
            <Label htmlFor="expense-reason">{t('Reason (optional)')}</Label>
            <Input
              id="expense-reason"
              {...fieldAttributes(state, 'reason', scope)}
              placeholder={t('Unexpected bill, guests...')}
              maxLength={160}
              className={FIELD_CLASS}
            />
            <FieldError state={state} name="reason" scope={scope} />
          </div>
        </div>
      ) : null}
    </>
  )
}

// `left` is what remains of today's budget. `hasBudget` is false when the plan
// gives no daily budget, in which case nothing can go over.
export function AddExpenseDrawer({
  left,
  hasBudget,
  chests = [],
}: {
  left: number
  hasBudget: boolean
  // The chests that could pay for it instead of today's budget.
  chests?: PayingChest[]
}) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('Add an expense')}
      description={
        chests.length > 0
          ? t("It counts against today's budget, unless one of your chests pays for it.")
          : t("It counts against today's budget.")
      }
      trigger={
        <Button className="h-12 w-full text-base">
          <Plus aria-hidden="true" />
          {t('Add expense')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={addExpense} submitLabel={t('Add expense')} onDone={close}>
          {(state) => <ExpenseFields state={state} left={left} hasBudget={hasBudget} chests={chests} />}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function ConfirmIncomeDrawer({ income }: { income: { id: string; source: string; usualAmount: number } }) {
  const t = useT()
  const scope = `income-${income.id}`

  return (
    <ActionDrawer
      title={t('{source} arrived', { source: income.source })}
      description={t(
        'Enter what really came in. Your planned savings and the income no allocation claims go into your chests.',
      )}
      trigger={
        <Button variant="outline" className="h-11">
          <BanknoteArrowDown aria-hidden="true" />
          {t('Confirm')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={confirmIncomeAction} submitLabel={t('Confirm income')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="incomeId" value={income.id} />
              <AmountField state={state} scope={scope} defaultValue={income.usualAmount} />
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function SaveRemainingDrawer({
  available,
  chests,
}: {
  available: number
  chests: { id: string; name: string }[]
}) {
  const t = useT()
  const scope = 'saving'

  return (
    <ActionDrawer
      title={t('Save what is left')}
      description={t("Up to {amount} {currency} is left from today's budget.", {
        amount: available,
        currency: CURRENCY_CODE,
      })}
      trigger={
        <Button variant="outline" className="h-12 w-full text-base">
          <PiggyBank aria-hidden="true" />
          {t('Save {amount}', { amount: available })}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={saveRemaining} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <AmountField state={state} scope={scope} defaultValue={available} />
              {chests.length > 0 ? (
                <div className="grid gap-2">
                  <Label htmlFor="saving-chest">{t('Into')}</Label>
                  <NativeSelect
                    id="saving-chest"
                    {...fieldAttributes(state, 'destinationChestId', scope)}
                    defaultValue={chests.find((chest) => chest.name === 'Buffer')?.id ?? chests[0].id}
                    className={FIELD_CLASS}
                  >
                    {chests.map((chest) => (
                      <NativeSelectOption key={chest.id} value={chest.id}>
                        {t(chest.name)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError state={state} name="destinationChestId" scope={scope} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('It goes to your Buffer chest.')}</p>
              )}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function ExceptionDrawer({ overspend }: { overspend: number }) {
  const t = useT()
  const scope = 'exception'

  return (
    <ActionDrawer
      title={t('Explain the overspend')}
      description={t('You are {amount} {currency} over today. A short reason helps the review.', {
        amount: overspend,
        currency: CURRENCY_CODE,
      })}
      trigger={
        <Button variant="outline" className="h-12 w-full text-base">
          <MessageSquareWarning aria-hidden="true" />
          {t('Explain overspend')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={recordException} submitLabel={t('Record')} onDone={close}>
          {(state) => (
            <>
              <CategoryChips categories={EXCEPTION_CATEGORIES} legend={t('What caused it?')} />
              <FieldError state={state} name="category" scope={scope} />
              <div className="grid gap-2">
                <Label htmlFor="exception-reason">{t('Reason (optional)')}</Label>
                <Input
                  id="exception-reason"
                  {...fieldAttributes(state, 'reason', scope)}
                  placeholder={t('Unexpected bill, guests...')}
                  maxLength={160}
                  autoFocus
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="reason" scope={scope} />
              </div>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
