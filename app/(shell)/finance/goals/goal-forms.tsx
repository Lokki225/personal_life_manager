'use client'

import { HandCoins, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { fieldAttributes } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { ActionDrawer, ActionForm, AmountField, FIELD_CLASS } from '../today-actions'
import { createGoalAction, fundGoalAction } from './actions'

export function NewGoalDrawer() {
  const t = useT()
  const scope = 'goal'

  return (
    <ActionDrawer
      title={t('New savings goal')}
      description={t('It gets its own chest. The goal is reached when that chest holds the target.')}
      trigger={
        <Button variant="outline" className="h-11">
          <Plus aria-hidden="true" />
          {t('New goal')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createGoalAction} submitLabel={t('Create goal')} onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor="goal-name">{t('Saving for')}</Label>
                <Input
                  id="goal-name"
                  {...fieldAttributes(state, 'name', scope)}
                  placeholder={t('Headphones, emergency fund...')}
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
                label={t('Target ({currency})', { currency: CURRENCY_CODE })}
                autoFocus={false}
              />
              <div className="grid gap-2">
                <Label htmlFor="goal-alreadySaved">{t('Already put aside (optional)')}</Label>
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
  const t = useT()
  const scope = 'funding'

  if (goals.length === 0 || chests.length === 0) {
    return null
  }

  return (
    <ActionDrawer
      title={t('Fund a goal')}
      description={t("Move money from one of your chests into the goal's chest.")}
      trigger={
        <Button className="h-11">
          <HandCoins aria-hidden="true" />
          {t('Fund a goal')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={fundGoalAction} submitLabel={t('Fund goal')} onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor="funding-goal">{t('Goal')}</Label>
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
                <Label htmlFor="funding-source">{t('From')}</Label>
                <NativeSelect
                  id="funding-source"
                  {...fieldAttributes(state, 'sourceChestId', scope)}
                  className={FIELD_CLASS}
                >
                  {chests.map((chest) => (
                    <NativeSelectOption key={chest.id} value={chest.id}>
                      {t(chest.name)} ({t.amount(chest.balance)})
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
