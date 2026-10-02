'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { CircleAlert, Layers, Loader2, Lock, Plus, Save, Trash2, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { FieldError } from '@/components/ui/field-error'
import { CURRENCY_CODE, dailyLivingBudget } from '@/domain/finance/calculations'
import { fieldAttributes, fieldName, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { saveSetupPlan } from './actions'

type AllocationDraft = {
  id: number
  name: string
  amount: string
  period: 'monthly' | 'weekly'
  category: string
}

type IncomeFrequency = 'monthly' | 'weekly' | 'occasional' | 'recurring'

type FinanceSetupInitialData = {
  incomeSource?: string
  incomeAmount?: number
  incomeFrequency?: IncomeFrequency
  incomePayDay?: number
  allocations?: AllocationDraft[]
}

type SetupFormProps = {
  // Pass this in (e.g. from a loaded plan) to seed the form instead of the
  // hardcoded fallbacks below. Nothing is required — every field falls back
  // to a sane default.
  initialData?: FinanceSetupInitialData
}

const DEFAULT_INCOME_SOURCE = m('Salary')
const DEFAULT_INCOME_AMOUNT = 5000
const DEFAULT_INCOME_FREQUENCY: IncomeFrequency = 'monthly'
const DEFAULT_ALLOCATIONS: AllocationDraft[] = []

const PERIODS: { value: AllocationDraft['period']; label: string }[] = [
  { value: 'monthly', label: m('Monthly') },
  { value: 'weekly', label: m('Weekly') },
]

const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  daily_living: { label: m('Daily living'), className: 'bg-category-daily-living/15 text-category-daily-living' },
  fixed: { label: m('Fixed'), className: 'bg-category-fixed/15 text-category-fixed' },
  subscription: { label: m('Subscription'), className: 'bg-category-subscription/15 text-category-subscription' },
  savings: { label: m('Savings'), className: 'bg-category-savings/15 text-category-savings' },
  custom: { label: m('Custom'), className: 'bg-category-custom/15 text-category-custom' },
}

// 44px touch targets and 16px text on phones (avoids iOS zoom on focus),
// compact from the sm breakpoint up.
const FIELD_CLASS = 'h-11 text-base sm:h-9 sm:text-sm'

function Amount({ value, className }: { value: number; className?: string }) {
  const t = useT()

  return (
    <span className={cn('shrink-0 whitespace-nowrap tabular-nums', className)}>
      {t.amount(value)}
      <span className="ml-1 text-xs font-medium text-muted-foreground">{CURRENCY_CODE}</span>
    </span>
  )
}

const createAllocation = (name: string, amount: string, period: 'monthly' | 'weekly', category_name: string): AllocationDraft => ({
  id: Date.now() + Math.random(),
  name,
  amount,
  period,
  category: category_name,
})

export function SetupForm({ initialData }: SetupFormProps = {}) {
  const t = useT()
  const [incomeSource, setIncomeSource] = useState(initialData?.incomeSource ?? t(DEFAULT_INCOME_SOURCE))
  const [incomeAmount, setIncomeAmount] = useState(initialData?.incomeAmount ?? DEFAULT_INCOME_AMOUNT)
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>(
    initialData?.incomeFrequency ?? DEFAULT_INCOME_FREQUENCY,
  )
  const [allocations, setAllocations] = useState<AllocationDraft[]>(
    initialData?.allocations ?? DEFAULT_ALLOCATIONS,
  )
  const [state, formAction, isPending] = useActionState(saveSetupPlan, initialFormState)
  // Row errors are keyed by index, so they are hidden once rows are added or
  // removed, until the next submit returns a fresh state.
  const [staleState, setStaleState] = useState<FormState | null>(null)
  const rowState = staleState === state ? initialFormState : state

  const derivedDailyBudget = dailyLivingBudget(
    allocations.map((allocation) => ({
      amount: Number(allocation.amount || 0),
      period: allocation.period,
      category: allocation.category,
    })),
    new Date(),
  )

  const updateAllocation = (id: number, field: keyof AllocationDraft, value: string) => {
    setAllocations((currentAllocations) =>
      currentAllocations.map((allocation) =>
        allocation.id === id
          ? {
              ...allocation,
              [field]: field === 'amount' ? value : value,
            }
          : allocation,
      ),
    )
  }

  // Submitting through `action` makes React reset the form afterwards, which
  // reverts the selects to their initial option. Dispatching by hand avoids it.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  const addAllocation = (name: string, amount: string, period: 'monthly' | 'weekly', category: string) => {
    setStaleState(state)
    setAllocations((currentAllocations) => [...currentAllocations, createAllocation(name, amount, period, category)])
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Right padding keeps the title clear of the sign-out and theme buttons */}
      <header className="pr-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('Finance setup')}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t('Plan your monthly budget')}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t('Capture your income and the recurring allocations that shape your daily budget.')}
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="size-5 text-muted-foreground" aria-hidden="true" />
                {t('Income')}
              </CardTitle>
              <CardDescription>{t('What comes in, and how often.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="incomeSource">{t('Source')}</Label>
                <Input
                  id="incomeSource"
                  {...fieldAttributes(state, 'incomeSource')}
                  value={incomeSource}
                  onChange={(event) => setIncomeSource(event.target.value)}
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="incomeSource" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="incomeAmount">{t('Amount ({currency})', { currency: CURRENCY_CODE })}</Label>
                <Input
                  id="incomeAmount"
                  type="number"
                  inputMode="decimal"
                  {...fieldAttributes(state, 'incomeAmount')}
                  value={incomeAmount}
                  onChange={(event) => setIncomeAmount(Number(event.target.value || 0))}
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="incomeAmount" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="incomeFrequency">{t('Frequency')}</Label>
                <NativeSelect
                  id="incomeFrequency"
                  {...fieldAttributes(state, 'incomeFrequency')}
                  value={incomeFrequency}
                  onChange={(event) => setIncomeFrequency(event.target.value as IncomeFrequency)}
                  className={FIELD_CLASS}
                >
                  <NativeSelectOption value="monthly">{t('Monthly')}</NativeSelectOption>
                  <NativeSelectOption value="weekly">{t('Weekly')}</NativeSelectOption>
                  <NativeSelectOption value="occasional">{t('Occasional')}</NativeSelectOption>
                  <NativeSelectOption value="recurring">{t('Recurring')}</NativeSelectOption>
                </NativeSelect>
                <FieldError state={state} name="incomeFrequency" />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="incomePayDay">{t('Pay day (day of the month)')}</Label>
                <Input
                  id="incomePayDay"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  {...fieldAttributes(state, 'incomePayDay')}
                  defaultValue={initialData?.incomePayDay ?? new Date().getDate()}
                  className={FIELD_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  {t('You will be asked to confirm it on that day, starting a month from now.')}
                </p>
                <FieldError state={state} name="incomePayDay" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
                {t('Allocations')}
              </CardTitle>
              <CardDescription>{t('Where the money is planned to go.')}</CardDescription>
              <CardAction>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addAllocation('', '', 'monthly', 'fixed')}
                  className="h-11 sm:h-9"
                >
                  <Plus aria-hidden="true" />
                  {t('Add')}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldError state={state} name="allocations" />

              {allocations.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('No allocations yet. Add rent, subscriptions, savings and your daily living budget.')}
                </p>
              ) : null}

              {allocations.map((allocation, index) => {
                const fieldId = (field: string) => `allocation-${index}-${field}`
                const rowField = (field: string) => fieldName('allocations', index, field)

                return (
                  <div
                    key={allocation.id}
                    role="group"
                    aria-labelledby={fieldId('title')}
                    className="rounded-lg border bg-muted/40 p-4"
                  >
                    <div className="mb-3 flex min-h-11 items-center justify-between sm:min-h-9">
                      <p id={fieldId('title')} className="text-sm font-semibold">
                        {t('Allocation {number}', { number: String(index + 1) })}
                      </p>
                      {allocations.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setStaleState(state)
                            setAllocations((currentAllocations) =>
                              currentAllocations.filter((entry) => entry.id !== allocation.id),
                            )
                          }}
                          className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:size-9"
                          aria-label={t('Remove allocation {number}', { number: String(index + 1) })}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="mb-3 empty:hidden">
                      <FieldError state={rowState} name={fieldName('allocations', index)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 grid gap-2">
                        <Label htmlFor={fieldId('name')}>{t('Name')}</Label>
                        <Input
                          id={fieldId('name')}
                          {...fieldAttributes(rowState, rowField('name'))}
                          value={allocation.name}
                          onChange={(event) => updateAllocation(allocation.id, 'name', event.target.value)}
                          className={FIELD_CLASS}
                        />
                        <FieldError state={rowState} name={rowField('name')} />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={fieldId('amount')}>{t('Amount')}</Label>
                        <Input
                          id={fieldId('amount')}
                          type="number"
                          inputMode="decimal"
                          {...fieldAttributes(rowState, rowField('amount'))}
                          value={allocation.amount}
                          onChange={(event) => updateAllocation(allocation.id, 'amount', event.target.value)}
                          className={FIELD_CLASS}
                        />
                        <FieldError state={rowState} name={rowField('amount')} />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={fieldId('period')}>{t('Period')}</Label>
                        <NativeSelect
                          id={fieldId('period')}
                          {...fieldAttributes(rowState, rowField('period'))}
                          value={allocation.period}
                          onChange={(event) =>
                            updateAllocation(
                              allocation.id,
                              'period',
                              event.target.value as 'monthly' | 'weekly',
                            )
                          }
                          className={FIELD_CLASS}
                        >
                          <NativeSelectOption value="monthly">{t('Monthly')}</NativeSelectOption>
                          <NativeSelectOption value="weekly">{t('Weekly')}</NativeSelectOption>
                        </NativeSelect>
                        <FieldError state={rowState} name={rowField('period')} />
                      </div>

                      <div className="col-span-2 grid gap-2">
                        <Label htmlFor={fieldId('category')}>{t('Category')}</Label>
                        <NativeSelect
                          id={fieldId('category')}
                          {...fieldAttributes(rowState, rowField('category'))}
                          value={allocation.category}
                          onChange={(event) => updateAllocation(allocation.id, 'category', event.target.value)}
                          className={FIELD_CLASS}
                        >
                          <NativeSelectOption value="fixed">{t('Fixed')}</NativeSelectOption>
                          <NativeSelectOption value="subscription">{t('Subscription')}</NativeSelectOption>
                          <NativeSelectOption value="daily_living">{t('Daily living')}</NativeSelectOption>
                          <NativeSelectOption value="savings">{t('Savings')}</NativeSelectOption>
                          <NativeSelectOption value="custom">{t('Custom')}</NativeSelectOption>
                        </NativeSelect>
                        <FieldError state={rowState} name={rowField('category')} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {state.formErrors.length > 0 ? (
            <ul
              role="alert"
              className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-strong"
            >
              {state.formErrors.map((error: string) => (
                <li key={error} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {error}
                </li>
              ))}
            </ul>
          ) : null}

          <Button type="submit" disabled={isPending} className="h-11 w-full sm:w-auto sm:px-6">
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {isPending ? t('Saving...') : t('Save setup')}
          </Button>
        </form>

        <Card className="gap-0 lg:sticky lg:top-6" aria-label={t('Plan summary')}>
          <CardContent>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('Income')}</h2>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="line-clamp-2 font-semibold">{incomeSource || t('Untitled')}</span>
                <Badge className="bg-category-income/15 text-category-income first-letter:uppercase">
                  {t(incomeFrequency)}
                </Badge>
              </div>
              <Amount value={incomeAmount} className="text-xl font-semibold" />
            </div>

            <Separator className="my-4" />

            {allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('Add an allocation to see your plan here.')}</p>
            ) : (
              PERIODS.map(({ value, label }) => {
                const rows = allocations.filter((allocation) => allocation.period === value)

                if (rows.length === 0) {
                  return null
                }

                return (
                  <section key={value} className="mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {t(label)}
                    </h3>
                    <ul className="mt-1 divide-y">
                      {rows.map((allocation) => {
                        const badge = CATEGORY_BADGES[allocation.category] ?? CATEGORY_BADGES.custom

                        return (
                          <li key={allocation.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="line-clamp-2 font-semibold">{allocation.name || t('Untitled')}</span>
                              <Badge className={badge.className}>
                                {allocation.category === 'daily_living' ? <Lock aria-hidden="true" /> : null}
                                {t(badge.label)}
                              </Badge>
                            </div>
                            <Amount value={Number(allocation.amount || 0)} className="font-semibold" />
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })
            )}

            <Separator className="my-4" />

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t('Derived daily budget')}</span>
              <Amount value={derivedDailyBudget} className="text-xl font-semibold" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
