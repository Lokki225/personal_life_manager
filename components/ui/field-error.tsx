import { fieldError, fieldErrorId, type FormState } from '@/lib/forms/formState'

export function FieldError({ state, name, scope }: { state: FormState; name: string; scope?: string }) {
  const message = fieldError(state, name)

  if (!message) {
    return null
  }

  return (
    <p id={fieldErrorId(name, scope)} className="text-sm text-destructive-strong">
      {message}
    </p>
  )
}
