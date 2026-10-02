'use client'

import { startTransition, useActionState, useState } from 'react'
import { ArrowLeftRight, CircleAlert, Layers, Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { consolidateBufferAction, transferChests } from '../actions'
import { ActionDrawer, ActionForm, FIELD_CLASS } from '../today-actions'
import { createChestAction, deleteChestAction } from './actions'

type ChestOption = { id: string; name: string; balance: number }

export function NewChestDrawer() {
  const t = useT()
  const scope = 'chest'
  const [type, setType] = useState('AVAILABLE')

  return (
    <ActionDrawer
      title={t('New chest')}
      description={t('A place to keep money for one purpose.')}
      trigger={
        <Button variant="outline" className="h-11">
          <Plus aria-hidden="true" />
          {t('New chest')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createChestAction} submitLabel={t('Create chest')} onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor="chest-name">{t('Name')}</Label>
                <Input
                  id="chest-name"
                  {...fieldAttributes(state, 'name', scope)}
                  placeholder={t('Holidays, new phone...')}
                  maxLength={40}
                  autoFocus
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="name" scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chest-type">{t('Type')}</Label>
                <NativeSelect
                  id="chest-type"
                  {...fieldAttributes(state, 'type', scope)}
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <NativeSelectOption value="AVAILABLE">{t('Available: move money out any time')}</NativeSelectOption>
                  <NativeSelectOption value="SECURE">{t('Secure: can be locked until a date')}</NativeSelectOption>
                </NativeSelect>
                <FieldError state={state} name="type" scope={scope} />
              </div>
              {type === 'SECURE' ? (
                <div className="grid gap-2">
                  <Label htmlFor="chest-lockedUntil">{t('Locked until (optional)')}</Label>
                  <Input
                    id="chest-lockedUntil"
                    {...fieldAttributes(state, 'lockedUntil', scope)}
                    type="date"
                    className={FIELD_CLASS}
                  />
                  <FieldError state={state} name="lockedUntil" scope={scope} />
                </div>
              ) : null}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

function TransferFields({
  state,
  chests,
  defaultSourceId,
  defaultDestinationId,
}: {
  state: FormState
  chests: ChestOption[]
  defaultSourceId: string
  defaultDestinationId: string
}) {
  const t = useT()
  const scope = 'transfer'
  const balanceOf = (id: string) => Math.max(Math.floor(chests.find((chest) => chest.id === id)?.balance ?? 0), 0)
  const [sourceId, setSourceId] = useState(defaultSourceId)
  const [amount, setAmount] = useState(String(balanceOf(defaultSourceId) || ''))

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="transfer-source">{t('From')}</Label>
        <NativeSelect
          id="transfer-source"
          {...fieldAttributes(state, 'sourceChestId', scope)}
          value={sourceId}
          onChange={(event) => {
            setSourceId(event.target.value)
            // Offer the whole balance of the chosen chest, as the common case.
            setAmount(String(balanceOf(event.target.value) || ''))
          }}
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
      <div className="grid gap-2">
        <Label htmlFor="transfer-destination">{t('To')}</Label>
        <NativeSelect
          id="transfer-destination"
          {...fieldAttributes(state, 'destinationChestId', scope)}
          defaultValue={defaultDestinationId}
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
      <div className="grid gap-2">
        <Label htmlFor="transfer-amount">{t('Amount ({currency})', { currency: CURRENCY_CODE })}</Label>
        <Input
          id="transfer-amount"
          {...fieldAttributes(state, 'amount', scope)}
          type="number"
          inputMode="numeric"
          min={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
          className={`${FIELD_CLASS} text-lg font-semibold`}
        />
        <FieldError state={state} name="amount" scope={scope} />
      </div>
    </>
  )
}

export function TransferDrawer({ chests }: { chests: ChestOption[] }) {
  const t = useT()
  // The usual move is Buffer to Base Chest, so that is what opens.
  const source = chests.find((chest) => chest.name === 'Buffer') ?? chests[0]
  const destination =
    chests.find((chest) => chest.name === 'Base Chest' && chest.id !== source.id) ??
    chests.find((chest) => chest.id !== source.id)

  if (!source || !destination) {
    return null
  }

  return (
    <ActionDrawer
      title={t('Transfer between chests')}
      description={t('Money moves from one chest to another. Nothing is spent.')}
      trigger={
        <Button variant="outline" className="h-11">
          <ArrowLeftRight aria-hidden="true" />
          {t('Transfer')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={transferChests} submitLabel={t('Transfer')} onDone={close}>
          {(state) => (
            <TransferFields
              state={state}
              chests={chests}
              defaultSourceId={source.id}
              defaultDestinationId={destination.id}
            />
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

// One tap: everything in the Buffer goes to the Base Chest.
export function ConsolidateButton({ bufferBalance }: { bufferBalance: number }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(consolidateBufferAction, initialFormState)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => formAction(new FormData()))}
        className="h-auto min-h-11 w-full py-2 whitespace-normal"
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Layers aria-hidden="true" />}
        {t('Consolidate {amount} {currency} into Base Chest', { amount: bufferBalance, currency: CURRENCY_CODE })}
      </Button>
      {state.formErrors.length > 0 ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive-strong">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}
    </div>
  )
}

// Deleting asks once more in place, since it cannot be undone.
export function DeleteChestButton({ chestId, chestName }: { chestId: string; chestName: string }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, isPending] = useActionState(deleteChestAction, initialFormState)

  const submit = () => {
    const formData = new FormData()
    formData.set('chestId', chestId)
    startTransition(() => formAction(formData))
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setConfirming(true)}
        className="-mr-2 size-11 text-muted-foreground hover:text-destructive-strong"
        aria-label={t('Delete {name}', { name: chestName })}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">{t('Delete {name}? This cannot be undone.', { name: chestName })}</p>
      <div className="flex gap-2">
        <Button type="button" variant="destructive" disabled={isPending} onClick={submit} className="h-11 flex-1">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {t('Delete')}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirming(false)} className="h-11 flex-1">
          {t('Keep')}
        </Button>
      </div>
      {state.formErrors.length > 0 ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {state.formErrors[0]}
        </p>
      ) : null}
    </div>
  )
}
