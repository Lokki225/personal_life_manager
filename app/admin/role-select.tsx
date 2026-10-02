'use client'

import { startTransition, useActionState } from 'react'

import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { changeRoleAction } from './actions'

// Changes a person's role as soon as another one is picked.
export function RoleSelect({ userId, name, role }: { userId: string; name: string; role: 'USER' | 'ADMIN' }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(changeRoleAction, initialFormState)
  const error = state.formErrors[0] ?? Object.values(state.fieldErrors)[0]?.[0]

  return (
    <div className="space-y-1">
      <NativeSelect
        // Back to the saved role when the change was refused.
        key={`${role}-${state.status}`}
        defaultValue={role}
        disabled={isPending}
        aria-label={t('Role of {name}', { name })}
        onChange={(event) => {
          const formData = new FormData()
          formData.set('userId', userId)
          formData.set('role', event.target.value)
          startTransition(() => formAction(formData))
        }}
        className="h-11 text-base sm:text-sm"
      >
        <NativeSelectOption value="USER">{t('User')}</NativeSelectOption>
        <NativeSelectOption value="ADMIN">{t('Administrator')}</NativeSelectOption>
      </NativeSelect>
      {error ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {error}
        </p>
      ) : null}
    </div>
  )
}
