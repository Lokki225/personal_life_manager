'use client'

import { startTransition, useActionState, useState } from 'react'
import { ArrowLeftRight, CircleAlert, Layers, Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CURRENCY_CODE, formatAmount } from '@/domain/finance/calculations'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'

import { consolidateBufferAction, transferChests } from '../actions'
import { ActionDrawer, ActionForm, FIELD_CLASS } from '../today-actions'
import { createChestAction } from './actions'

type ChestOption = { id: string; name: string; balance: number }

export function NewChestDrawer() {
  const scope = 'chest'
  const [type, setType] = useState('AVAILABLE')

  return (
    <ActionDrawer
      title="New chest"
      description="A place to keep money for one purpose."
      trigger={
        <Button variant="outline" className="h-11">
          <Plus aria-hidden="true" />
          New chest
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createChestAction} submitLabel="Create chest" onDone={close}>
          {(state) => (
            <>
              <div className="grid gap-2">
                <Label htmlFor="chest-name">Name</Label>
                <Input
                  id="chest-name"
                  {...fieldAttributes(state, 'name', scope)}
                  placeholder="Holidays, new phone..."
                  maxLength={40}
                  autoFocus
                  className={FIELD_CLASS}
                />
                <FieldError state={state} name="name" scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chest-type">Type</Label>
                <NativeSelect
                  id="chest-type"
                  {...fieldAttributes(state, 'type', scope)}
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <NativeSelectOption value="AVAILABLE">Available: move money out any time</NativeSelectOption>
                  <NativeSelectOption value="SECURE">Secure: can be locked until a date</NativeSelectOption>
                </NativeSelect>
                <FieldError state={state} name="type" scope={scope} />
              </div>
              {type === 'SECURE' ? (
                <div className="grid gap-2">
                  <Label htmlFor="chest-lockedUntil">Locked until (optional)</Label>
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
  const scope = 'transfer'
  const balanceOf = (id: string) => Math.max(Math.floor(chests.find((chest) => chest.id === id)?.balance ?? 0), 0)
  const [sourceId, setSourceId] = useState(defaultSourceId)
  const [amount, setAmount] = useState(String(balanceOf(defaultSourceId) || ''))

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="transfer-source">From</Label>
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
              {chest.name} ({formatAmount(chest.balance)})
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError state={state} name="sourceChestId" scope={scope} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="transfer-destination">To</Label>
        <NativeSelect
          id="transfer-destination"
          {...fieldAttributes(state, 'destinationChestId', scope)}
          defaultValue={defaultDestinationId}
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
      <div className="grid gap-2">
        <Label htmlFor="transfer-amount">Amount ({CURRENCY_CODE})</Label>
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
      title="Transfer between chests"
      description="Money moves from one chest to another. Nothing is spent."
      trigger={
        <Button variant="outline" className="h-11">
          <ArrowLeftRight aria-hidden="true" />
          Transfer
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={transferChests} submitLabel="Transfer" onDone={close}>
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
  const [state, formAction, isPending] = useActionState(consolidateBufferAction, initialFormState)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => formAction(new FormData()))}
        className="h-11 w-full"
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Layers aria-hidden="true" />}
        Consolidate {formatAmount(bufferBalance)} {CURRENCY_CODE} into Base Chest
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
