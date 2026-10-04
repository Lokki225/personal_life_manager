'use client'

import { useState } from 'react'
import { ListChecks, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { aimsDown } from '@/domain/goals/financeGoals'
import { fieldAttributes, fieldName, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'

import { MEASUREMENT_LABELS, OPERATOR_LABELS } from '../goal-labels'
import { ActionDrawer, ActionForm, FIELD_CLASS } from '../today-actions'
import { createCustomGoalAction } from './actions'

const MAX_CONDITIONS = 5
const scope = 'custom-goal'

type ConditionRow = { key: number; measurement: string }

const newRow = (key: number): ConditionRow => ({ key, measurement: 'chest_balance' })

function GoalBuilderFields({ state, chests }: { state: FormState; chests: { id: string; name: string }[] }) {
  const t = useT()
  const [rows, setRows] = useState<ConditionRow[]>([newRow(0)])
  const [nextKey, setNextKey] = useState(1)
  // Row errors are keyed by position, so they are hidden once rows move.
  const [staleState, setStaleState] = useState<FormState | null>(null)
  const rowState = staleState === state ? initialFormState : state

  const addRow = () => {
    setStaleState(state)
    setRows((current) => [...current, newRow(nextKey)])
    setNextKey((key) => key + 1)
  }

  const removeRow = (key: number) => {
    setStaleState(state)
    setRows((current) => current.filter((row) => row.key !== key))
  }

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="custom-goal-name">{t('Goal')}</Label>
        <Input
          id="custom-goal-name"
          {...fieldAttributes(state, 'name', scope)}
          placeholder={t('A disciplined month')}
          maxLength={40}
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="name" scope={scope} />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t('It is reached when')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'ALL', label: m('All conditions hold') },
            { value: 'ANY', label: m('Any one holds') },
          ].map((option, index) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="logic"
                value={option.value}
                defaultChecked={index === 0}
                className="peer sr-only"
              />
              <span className="flex min-h-12 items-center justify-center rounded-md border border-input px-3 text-center text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                {t(option.label)}
              </span>
            </label>
          ))}
        </div>
        <FieldError state={state} name="logic" scope={scope} />
      </fieldset>

      <FieldError state={state} name="conditions" scope={scope} />

      {rows.map((row, index) => {
        const name = (field: string) => fieldName('conditions', index, field)
        const id = (field: string) => `${scope}-${row.key}-${field}`

        return (
          <div
            key={row.key}
            role="group"
            aria-labelledby={id('title')}
            className="space-y-3 rounded-lg border bg-muted/40 p-3"
          >
            <div className="flex min-h-11 items-center justify-between">
              <p id={id('title')} className="text-sm font-semibold">
                {t('Condition {number}', { number: String(index + 1) })}
              </p>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.key)}
                  className="-mr-2 size-11 text-muted-foreground hover:text-destructive-strong"
                  aria-label={t('Remove condition {number}', { number: String(index + 1) })}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <FieldError state={rowState} name={fieldName('conditions', index)} scope={scope} />

            <div className="grid gap-2">
              <Label htmlFor={id('measurement')}>{t('Measure')}</Label>
              <NativeSelect
                id={id('measurement')}
                {...fieldAttributes(rowState, name('measurement'), scope)}
                value={row.measurement}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((candidate) =>
                      candidate.key === row.key ? { ...candidate, measurement: event.target.value } : candidate,
                    ),
                  )
                }
                className={FIELD_CLASS}
              >
                {Object.entries(MEASUREMENT_LABELS).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {t(label)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError state={rowState} name={name('measurement')} scope={scope} />
            </div>

            {row.measurement === 'chest_balance' ? (
              <div className="grid gap-2">
                <Label htmlFor={id('chestId')}>{t('Chest')}</Label>
                <NativeSelect
                  id={id('chestId')}
                  {...fieldAttributes(rowState, name('chestId'), scope)}
                  className={FIELD_CLASS}
                >
                  {chests.map((chest) => (
                    <NativeSelectOption key={chest.id} value={chest.id}>
                      {t(chest.name)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError state={rowState} name={name('chestId')} scope={scope} />
              </div>
            ) : null}

            {row.measurement === 'monthly_category_spending' ? (
              <div className="grid gap-2">
                <Label htmlFor={id('category')}>{t('Category')}</Label>
                <NativeSelect
                  id={id('category')}
                  {...fieldAttributes(rowState, name('category'), scope)}
                  className={FIELD_CLASS}
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <NativeSelectOption key={category} value={category}>
                      {t(category)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError state={rowState} name={name('category')} scope={scope} />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor={id('operator')}>{t('Is')}</Label>
                <NativeSelect
                  id={id('operator')}
                  {...fieldAttributes(rowState, name('operator'), scope)}
                  // Savings aim up; spending, exceptions and debt aim down.
                  key={row.measurement}
                  defaultValue={aimsDown(row.measurement) ? 'LTE' : 'GTE'}
                  className={FIELD_CLASS}
                >
                  {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {t(label)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError state={rowState} name={name('operator')} scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={id('targetValue')}>{t('Target')}</Label>
                <Input
                  id={id('targetValue')}
                  {...fieldAttributes(rowState, name('targetValue'), scope)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  className={FIELD_CLASS}
                />
                <FieldError state={rowState} name={name('targetValue')} scope={scope} />
              </div>
            </div>
          </div>
        )
      })}

      {rows.length < MAX_CONDITIONS ? (
        <Button type="button" variant="outline" onClick={addRow} className="h-11 w-full">
          <Plus aria-hidden="true" />
          {t('Add a condition')}
        </Button>
      ) : null}
    </>
  )
}

export function CustomGoalDrawer({ chests }: { chests: { id: string; name: string }[] }) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('Custom goal')}
      description={t('Combine several conditions, such as savings to reach and a limit on spending.')}
      trigger={
        <Button variant="outline" className="h-11">
          <ListChecks aria-hidden="true" />
          {t('Custom goal')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createCustomGoalAction} submitLabel={t('Create goal')} onDone={close}>
          {(state) => <GoalBuilderFields state={state} chests={chests} />}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
