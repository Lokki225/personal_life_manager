'use client'

import { startTransition, useActionState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { Field, Textarea } from '../fields'
import { saveAnswersAction } from './actions'

// The review's two optional questions; answers become Career log lines.
export function ReviewQuestions({ forward, next }: { forward: string; next: string }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(saveAnswersAction, initialFormState)
  const scope = 'review'
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form key={state.status === 'success' ? 'saved' : 'editing'} onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4" noValidate>
      <Field state={state} name="forward" label={forward} scope={scope}>
        <Textarea id={`${scope}-forward`} {...fieldAttributes(state, 'forward', scope)} maxLength={1000} rows={2} />
      </Field>
      <Field state={state} name="next" label={next} scope={scope}>
        <Textarea id={`${scope}-next`} {...fieldAttributes(state, 'next', scope)} maxLength={1000} rows={2} />
      </Field>
      {state.formErrors[0] ? <p className="text-sm text-destructive-strong">{state.formErrors[0]}</p> : null}
      <Button type="submit" variant="outline" disabled={isPending} className="h-10">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {state.status === 'success' && !isPending ? t('Saved in your log.') : t('Save')}
      </Button>
    </form>
  )
}
