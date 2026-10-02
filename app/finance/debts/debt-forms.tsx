'use client'

import { useState } from 'react'
import { HandCoins, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import type { DebtDirection } from '@/domain/finance/options'
import { fieldAttributes, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'

import { ActionDrawer, ActionForm, AmountField, FIELD_CLASS } from '../today-actions'
import { createDebtAction, repayDebtAction } from './actions'

// The Buffer, the Base Chest and the Debts Chest.
type ChestOption = { id: string; name: string; balance: number }
type GoalOption = { id: string; name: string }

const DIRECTIONS: { value: DebtDirection; label: string }[] = [
  { value: 'BORROWED', label: m('I borrowed') },
  { value: 'LENT', label: m('I lent') },
]

function SourceChestField({
  state,
  scope,
  chests,
  defaultChestId,
}: {
  state: FormState
  scope: string
  chests: ChestOption[]
  defaultChestId?: string
}) {
  const t = useT()

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${scope}-chestId`}>{t('Take it from')}</Label>
      <NativeSelect
        id={`${scope}-chestId`}
        {...fieldAttributes(state, 'chestId', scope)}
        defaultValue={defaultChestId}
        className={FIELD_CLASS}
      >
        {chests.map((chest) => (
          <NativeSelectOption key={chest.id} value={chest.id}>
            {t(chest.name)} ({t.amount(chest.balance)})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldError state={state} name="chestId" scope={scope} />
    </div>
  )
}

function DebtFields({ state, chests, goals }: { state: FormState; chests: ChestOption[]; goals: GoalOption[] }) {
  const t = useT()
  const scope = 'debt'
  const [direction, setDirection] = useState<DebtDirection>('BORROWED')
  const [interestType, setInterestType] = useState('NONE')
  const borrowed = direction === 'BORROWED'

  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t('What happened?')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {DIRECTIONS.map(({ value, label }) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="direction"
                value={value}
                checked={direction === value}
                onChange={() => setDirection(value)}
                className="peer sr-only"
              />
              <span className="flex h-12 items-center justify-center rounded-md border border-input px-3 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                {t(label)}
              </span>
            </label>
          ))}
        </div>
        <FieldError state={state} name="direction" scope={scope} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="debt-counterparty">{borrowed ? t('From') : t('To')}</Label>
        <Input
          id="debt-counterparty"
          {...fieldAttributes(state, 'counterparty', scope)}
          placeholder={t('A person, a company, an app...')}
          maxLength={60}
          autoFocus
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="counterparty" scope={scope} />
      </div>

      <AmountField state={state} scope={scope} autoFocus={false} />

      {borrowed && goals.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="debt-goalId">{t('For a goal (optional)')}</Label>
          <NativeSelect id="debt-goalId" {...fieldAttributes(state, 'goalId', scope)} className={FIELD_CLASS}>
            <NativeSelectOption value="">{t('No goal: keep it in the Debts Chest')}</NativeSelectOption>
            {goals.map((goal) => (
              <NativeSelectOption key={goal.id} value={goal.id}>
                {goal.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError state={state} name="goalId" scope={scope} />
        </div>
      ) : borrowed ? (
        <p className="text-sm text-muted-foreground">{t('It goes into your Debts Chest.')}</p>
      ) : (
        <SourceChestField state={state} scope={scope} chests={chests} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={interestType === 'NONE' ? 'col-span-2 grid gap-2' : 'grid gap-2'}>
          <Label htmlFor="debt-interestType">{t('Interest')}</Label>
          <NativeSelect
            id="debt-interestType"
            {...fieldAttributes(state, 'interestType', scope)}
            value={interestType}
            onChange={(event) => setInterestType(event.target.value)}
            className={FIELD_CLASS}
          >
            <NativeSelectOption value="NONE">{t('No interest')}</NativeSelectOption>
            <NativeSelectOption value="PERCENT">{t('Percent')}</NativeSelectOption>
            <NativeSelectOption value="FIXED">{t('Fixed amount')}</NativeSelectOption>
          </NativeSelect>
          <FieldError state={state} name="interestType" scope={scope} />
        </div>
        {interestType === 'NONE' ? null : (
          <div className="grid gap-2">
            <Label htmlFor="debt-interestValue">
              {interestType === 'PERCENT' ? t('Rate (%)') : t('Amount ({currency})', { currency: CURRENCY_CODE })}
            </Label>
            <Input
              id="debt-interestValue"
              {...fieldAttributes(state, 'interestValue', scope)}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0"
              className={FIELD_CLASS}
            />
          </div>
        )}
        <div className="col-span-2 empty:hidden">
          <FieldError state={state} name="interestValue" scope={scope} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="debt-dueDate">{t('Due date (optional)')}</Label>
        <Input id="debt-dueDate" {...fieldAttributes(state, 'dueDate', scope)} type="date" className={FIELD_CLASS} />
        <FieldError state={state} name="dueDate" scope={scope} />
      </div>
    </>
  )
}

export function NewDebtDrawer({ chests, goals }: { chests: ChestOption[]; goals: GoalOption[] }) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('New debt or loan')}
      description={t('Money you borrowed, or money you lent to someone.')}
      trigger={
        <Button variant="outline" className="h-11">
          <Plus aria-hidden="true" />
          {t('New debt or loan')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createDebtAction} submitLabel={t('Record')} onDone={close}>
          {(state) => <DebtFields state={state} chests={chests} goals={goals} />}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function RepayDrawer({
  debt,
  chests,
}: {
  debt: { id: string; direction: DebtDirection; counterparty: string; outstanding: number }
  chests: ChestOption[]
}) {
  const t = useT()
  const scope = `repay-${debt.id}`
  const borrowed = debt.direction === 'BORROWED'
  // The Debts Chest pays when it can, since that is where the money went.
  const debtsChest = chests.find((chest) => chest.name === 'Debts Chest')
  const defaultChest =
    debtsChest && debtsChest.balance >= debt.outstanding
      ? debtsChest
      : (chests.find((chest) => chest.name === 'Base Chest') ?? chests[0])
  const left = { amount: debt.outstanding, currency: CURRENCY_CODE }

  return (
    <ActionDrawer
      title={
        borrowed
          ? t('Repay {name}', { name: debt.counterparty })
          : t('Repayment from {name}', { name: debt.counterparty })
      }
      description={
        borrowed ? t('{amount} {currency} is left to repay.', left) : t('{amount} {currency} is left to receive.', left)
      }
      trigger={
        <Button variant="outline" className="h-11">
          <HandCoins aria-hidden="true" />
          {borrowed ? t('Repay') : t('Record repayment')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={repayDebtAction} submitLabel={borrowed ? t('Repay') : t('Record')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="debtId" value={debt.id} />
              <AmountField state={state} scope={scope} defaultValue={Math.floor(debt.outstanding)} />
              {borrowed ? (
                <SourceChestField state={state} scope={scope} chests={chests} defaultChestId={defaultChest?.id} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('It comes back as new money, into your Base Chest.')}
                </p>
              )}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
