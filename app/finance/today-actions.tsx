'use client'

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from 'react'
import { BanknoteArrowDown, CircleAlert, Loader2, MessageSquareWarning, PiggyBank, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE, formatAmount } from '@/domain/finance/calculations'
import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'

import { addExpense, confirmIncomeAction, recordException, saveRemaining } from './actions'
import { categoryStyle } from './categories'

type FormAction = (previousState: FormState, formData: FormData) => Promise<FormState>

export const FIELD_CLASS = 'h-12 text-base'

// The form lives inside the drawer content, so it starts fresh on every open.
export function ActionForm({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: FormAction
  submitLabel: string
  onDone: () => void
  children: (state: FormState) => ReactNode
}) {
  const [state, formAction, isPending] = useActionState(async (previousState: FormState, formData: FormData) => {
    const nextState = await action(previousState, formData)

    if (nextState.status === 'success') {
      onDone()
    }

    return nextState
  }, initialFormState)

  // Dispatching by hand keeps what was typed when the server returns an error.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6" noValidate>
      {children(state)}

      {state.formErrors.length > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}

export function ActionDrawer({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode
  title: string
  description: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {children(() => setOpen(false))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function AmountField({
  state,
  scope,
  name = 'amount',
  label = `Amount (${CURRENCY_CODE})`,
  defaultValue,
  autoFocus = true,
}: {
  state: FormState
  scope: string
  name?: string
  label?: string
  defaultValue?: number
  autoFocus?: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${scope}-${name}`}>{label}</Label>
      <Input
        id={`${scope}-${name}`}
        {...fieldAttributes(state, name, scope)}
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={defaultValue}
        placeholder="0"
        autoFocus={autoFocus}
        className={`${FIELD_CLASS} text-lg font-semibold`}
      />
      <FieldError state={state} name={name} scope={scope} />
    </div>
  )
}

// Category choices as large tap targets instead of a dropdown.
function CategoryChips({ categories, legend }: { categories: readonly string[]; legend: string }) {
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
                name="category"
                value={category}
                defaultChecked={index === 0}
                className="peer sr-only"
              />
              <span className="flex h-12 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function AddExpenseDrawer() {
  const scope = 'expense'

  return (
    <ActionDrawer
      title="Add an expense"
      description="It counts against today's budget."
      trigger={
        <Button className="h-12 w-full text-base">
          <Plus aria-hidden="true" />
          Add expense
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={addExpense} submitLabel="Add expense" onDone={close}>
          {(state) => (
            <>
              <AmountField state={state} scope={scope} />
              <CategoryChips categories={EXPENSE_CATEGORIES} legend="Category" />
              <div className="grid gap-2">
                <Label htmlFor="expense-description">Note (optional)</Label>
                <Input
                  id="expense-description"
                  {...fieldAttributes(state, 'description', scope)}
                  placeholder="Lunch, taxi..."
                  maxLength={80}
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="description" scope={scope} />
              </div>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function ConfirmIncomeDrawer({ income }: { income: { id: string; source: string; usualAmount: number } }) {
  const scope = `income-${income.id}`

  return (
    <ActionDrawer
      title={`${income.source} arrived`}
      description="Enter what really came in. Your planned savings and the income no allocation claims go into your chests."
      trigger={
        <Button variant="outline" className="h-11">
          <BanknoteArrowDown aria-hidden="true" />
          Confirm
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={confirmIncomeAction} submitLabel="Confirm income" onDone={close}>
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
  const scope = 'saving'

  return (
    <ActionDrawer
      title="Save what is left"
      description={`Up to ${formatAmount(available)} ${CURRENCY_CODE} is left from today's budget.`}
      trigger={
        <Button variant="outline" className="h-12 w-full text-base">
          <PiggyBank aria-hidden="true" />
          Save {formatAmount(available)}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={saveRemaining} submitLabel="Save" onDone={close}>
          {(state) => (
            <>
              <AmountField state={state} scope={scope} defaultValue={available} />
              {chests.length > 0 ? (
                <div className="grid gap-2">
                  <Label htmlFor="saving-chest">Into</Label>
                  <NativeSelect
                    id="saving-chest"
                    {...fieldAttributes(state, 'destinationChestId', scope)}
                    defaultValue={chests.find((chest) => chest.name === 'Buffer')?.id ?? chests[0].id}
                    className={FIELD_CLASS}
                  >
                    {chests.map((chest) => (
                      <NativeSelectOption key={chest.id} value={chest.id}>
                        {chest.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError state={state} name="destinationChestId" scope={scope} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">It goes to your Buffer chest.</p>
              )}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function ExceptionDrawer({ overspend }: { overspend: number }) {
  const scope = 'exception'

  return (
    <ActionDrawer
      title="Explain the overspend"
      description={`You are ${formatAmount(overspend)} ${CURRENCY_CODE} over today. A short reason helps the review.`}
      trigger={
        <Button variant="outline" className="h-12 w-full text-base">
          <MessageSquareWarning aria-hidden="true" />
          Explain overspend
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={recordException} submitLabel="Record" onDone={close}>
          {(state) => (
            <>
              <CategoryChips categories={EXCEPTION_CATEGORIES} legend="What caused it?" />
              <FieldError state={state} name="category" scope={scope} />
              <div className="grid gap-2">
                <Label htmlFor="exception-reason">Reason (optional)</Label>
                <Input
                  id="exception-reason"
                  {...fieldAttributes(state, 'reason', scope)}
                  placeholder="Unexpected bill, guests..."
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
