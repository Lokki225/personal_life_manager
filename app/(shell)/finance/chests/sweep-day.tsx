'use client'

import { startTransition, useActionState } from 'react'

import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { setSweepDayAction } from './actions'

// 4 January 2026 is a Sunday, so day 0 to 6 of that week are Sunday to Saturday.
const weekday = (index: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2026, 0, 4 + index))

// Chooses the day of the week the Buffer is emptied into the Base Chest. It
// is saved as soon as another day is picked.
export function SweepDaySelect({ day }: { day: number }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(setSweepDayAction, initialFormState)
  const error = state.formErrors[0] ?? Object.values(state.fieldErrors)[0]?.[0]

  return (
    <div className="space-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
      <p className="font-medium">{t('Your Buffer fills and empties on its own')}</p>
      <p className="text-muted-foreground">
        {t('What is left of each day goes into the Buffer. Once a week it is emptied into your Base Chest.')}
      </p>
      <label className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-muted-foreground">{t('Emptied every')}</span>
        <NativeSelect
          // Back to the saved day when the change was refused.
          key={`${day}-${state.status}`}
          defaultValue={String(day)}
          disabled={isPending}
          onChange={(event) => {
            const formData = new FormData()
            formData.set('day', event.target.value)
            startTransition(() => formAction(formData))
          }}
          className="h-11 text-base first-letter:uppercase sm:text-sm"
        >
          {[1, 2, 3, 4, 5, 6, 0].map((index) => (
            <NativeSelectOption key={index} value={String(index)}>
              {weekday(index, t.intl)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      {error ? (
        <p role="alert" className="text-destructive-strong">
          {error}
        </p>
      ) : null}
    </div>
  )
}
