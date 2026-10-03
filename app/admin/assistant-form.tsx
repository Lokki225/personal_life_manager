'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Check, Loader2, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { resetAppRoleAction, saveAppPersonaAction } from './actions'

// What every assistant of the app is told: its name, its role, and whether
// each person may add their own instructions.
export function AssistantPersonaForm({
  name,
  role,
  isDefault,
  personalAllowed,
}: {
  name: string | null
  role: string
  isDefault: boolean
  personalAllowed: boolean
}) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(saveAppPersonaAction, initialFormState)
  const [resetError, setResetError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  const reset = async () => {
    setIsResetting(true)
    const result = await resetAppRoleAction()
    setResetError(result.error ?? null)
    setIsResetting(false)
  }

  return (
    // Keyed on what is saved, so the fields show it again after a reset.
    <form key={`${role}-${name}-${personalAllowed}`} onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="persona-name">{t('Name of the assistant')}</Label>
        <Input
          id="persona-name"
          {...fieldAttributes(state, 'name', 'persona')}
          defaultValue={name ?? ''}
          placeholder={t('Assistant')}
          maxLength={30}
          className="h-11 text-base sm:text-sm"
        />
        <FieldError state={state} name="name" scope="persona" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="persona-role">{t('Its role')}</Label>
        <textarea
          id="persona-role"
          {...fieldAttributes(state, 'role', 'persona')}
          defaultValue={role}
          maxLength={2000}
          rows={10}
          className="min-h-48 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {isDefault ? t('This is the default role.') : t('Written by an administrator.')}{' '}
          {t('Leave it empty to use the default. The rules of the app always come first.')}
        </p>
        <FieldError state={state} name="role" scope="persona" />
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="personalAllowed"
          defaultChecked={personalAllowed}
          className="size-5 shrink-0 accent-[var(--primary)]"
        />
        {t('Let each person add their own instructions')}
      </label>

      {state.formErrors.length > 0 || resetError ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {state.formErrors[0] ?? resetError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending} className="h-11">
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : state.status === 'success' ? (
            <Check aria-hidden="true" />
          ) : null}
          {state.status === 'success' && !isPending ? t('Saved') : t('Save')}
        </Button>
        {!isDefault ? (
          <Button type="button" variant="outline" disabled={isResetting} onClick={reset} className="h-11">
            {isResetting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            {t('Back to the default role')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
