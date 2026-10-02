'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Check, CircleAlert, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { createApiTokenAction, deleteApiTokenAction, type CreateTokenState } from './actions'

export type ApiKeyRow = { id: string; name: string; canRecord: boolean; created: string; lastUsed: string | null }

const initialCreateState: CreateTokenState = { ...initialFormState }

function DeleteKey({ id, name }: { id: string; name: string }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, isPending] = useActionState(deleteApiTokenAction, initialFormState)

  const submit = () => {
    const formData = new FormData()
    formData.set('id', id)
    startTransition(() => formAction(formData))
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setConfirming(true)}
        className="-mr-2 size-11 shrink-0 text-muted-foreground hover:text-destructive-strong"
        aria-label={t('Delete {name}', { name })}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    )
  }

  return (
    <div className="w-full space-y-2">
      <p className="text-sm">{t('Delete this key? Whatever uses it stops working at once.')}</p>
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

// Creates and deletes the keys that let a program use the API as this person.
export function ApiKeys({ keys }: { keys: ApiKeyRow[] }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(createApiTokenAction, initialCreateState)
  const [copied, setCopied] = useState(false)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setCopied(false)
    startTransition(() => formAction(formData))
  }

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      // Copying can be refused by the browser; the key stays visible to select.
    }
  }

  return (
    <div className="space-y-4">
      {state.token ? (
        <div role="status" className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">{t('Copy this key now. It will not be shown again.')}</p>
          <p className="rounded-md border bg-card px-2 py-1.5 font-mono text-xs break-all select-all">{state.token}</p>
          <Button type="button" variant="outline" onClick={() => copy(state.token!)} className="h-11">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t('Copied') : t('Copy the key')}
          </Button>
        </div>
      ) : null}

      {keys.length > 0 ? (
        <ul className="divide-y rounded-lg border px-3">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <span className="line-clamp-2">{key.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    key.canRecord ? t('Can read and record') : t('Can only read'),
                    t('Created {date}', { date: key.created }),
                    key.lastUsed ? t('Last used {date}', { date: key.lastUsed }) : t('Never used'),
                  ].join(' · ')}
                </p>
              </div>
              <DeleteKey id={key.id} name={key.name} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Keyed on success so the name empties itself once a key is made. */}
      <form key={state.token ?? 'new'} onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="api-key-name">{t('What is it for?')}</Label>
            <Input
              id="api-key-name"
              {...fieldAttributes(state, 'name', 'api-key')}
              placeholder={t('My assistant, a script...')}
              maxLength={40}
              className="h-11 text-base sm:text-sm"
            />
            <FieldError state={state} name="name" scope="api-key" />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="api-key-scope">{t('What may it do?')}</Label>
            <NativeSelect
              id="api-key-scope"
              {...fieldAttributes(state, 'scope', 'api-key')}
              defaultValue="READ"
              className="h-11 text-base sm:text-sm"
            >
              <NativeSelectOption value="READ">{t('Only read my data')}</NativeSelectOption>
              <NativeSelectOption value="WRITE">{t('Read, record and notify me')}</NativeSelectOption>
            </NativeSelect>
            <FieldError state={state} name="scope" scope="api-key" />
          </div>
        </div>

        {state.formErrors.length > 0 ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.formErrors[0]}
          </p>
        ) : null}

        <Button type="submit" variant="outline" disabled={isPending} className="h-11">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
          {t('Create a key')}
        </Button>
      </form>
    </div>
  )
}
