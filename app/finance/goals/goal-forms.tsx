'use client'

import { HandCoins, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE, formatAmount } from '@/domain/finance/calculations'
import { fieldAttributes } from '@/lib/forms/formState'

import { ActionDrawer, ActionForm, AmountField, FIELD_CLASS } from '../today-actions'
import { createGoalAction, fundGoalAction } from './actions'

export function NewGoalDrawer() {
  const scope = 'goal'

  return (
    <ActionDrawer
      title="New savings goal"
      description="It gets its own chest. The goal is reached when that chest holds the target."
      trigger={
        <Button variant="outline" className="h-11">
          <Plus aria-hidden="true" />
          New goal
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createGoalAction} submitLabel="Create goal" onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor="goal-name">Saving for</Label>
                <Input
                  id="goal-name"
                  {...fieldAttributes(state, 'name', scope)}
                  placeholder="Headphones, emergency fund..."
                  maxLength={40}
                  autoFocus
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="name" scope={scope} />
              </div>
              <AmountField
                state={state}
                scope={scope}
                name="targetAmount"
                label={`Target (${CURRENCY_CODE})`}
                autoFocus={false}
              />
              <div className="grid gap-2">
                <Label htmlFor="goal-alreadySaved">Already put aside (optional)</Label>
                <Input
                  id="goal-alreadySaved"
                  {...fieldAttributes(state, 'alreadySaved', scope)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="alreadySaved" scope={scope} />
              </div>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function FundGoalDrawer({
  goals,
  chests,
}: {
  goals: { id: string; name: string }[]
  chests: { id: string; name: string; balance: number }[]
}) {
  const scope = 'funding'

  if (goals.length === 0 || chests.length === 0) {
    return null
  }

  return (
    <ActionDrawer
      title="Fund a goal"
      description="Move money from one of your chests into the goal's chest."
      trigger={
        <Button className="h-11">
          <HandCoins aria-hidden="true" />
          Fund a goal
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={fundGoalAction} submitLabel="Fund goal" onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor="funding-goal">Goal</Label>
                <NativeSelect id="funding-goal" {...fieldAttributes(state, 'goalId', scope)} className={FIELD_CLASS}>
                  {goals.map((goal) => (
                    <NativeSelectOption key={goal.id} value={goal.id}>
                      {goal.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError state={state} name="goalId" scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="funding-source">From</Label>
                <NativeSelect
                  id="funding-source"
                  {...fieldAttributes(state, 'sourceChestId', scope)}
                  className={FIELD_CLASS}
                >
                  {chests.map((chest) => (
                    <NativeSelectOption key={chest.id} value={chest.id}>
                      {chest.name} ({formatAmount(chest.balance)})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError state={state} name="sourceChestId" scope={scope} />
              </div>
              <AmountField state={state} scope={scope} autoFocus={false} />
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
