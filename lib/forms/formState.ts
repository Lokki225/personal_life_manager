export type FormState = {
  status: 'idle' | 'error' | 'success'
  // Keyed by input name, e.g. "incomeAmount" or "allocations.0.amount".
  fieldErrors: Record<string, string[]>
  formErrors: string[]
  // Submitted values, echoed back on error so uncontrolled inputs can restore them.
  values?: Record<string, string>
}

export const initialFormState: FormState = { status: 'idle', fieldErrors: {}, formErrors: [] }

// fieldName('allocations', 0, 'amount') gives "allocations.0.amount".
export function fieldName(...segments: (string | number)[]): string {
  return segments.join('.')
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state.fieldErrors[name]?.[0]
}

// Pass a `scope` when a page holds several forms with the same field names,
// so their error ids stay unique.
export function fieldErrorId(name: string, scope?: string): string {
  return scope ? `${scope}-${name}-error` : `${name}-error`
}

// Spread onto an input: sets its name and links it to its error message.
export function fieldAttributes(state: FormState, name: string, scope?: string) {
  const hasError = fieldError(state, name) !== undefined

  return {
    name,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? fieldErrorId(name, scope) : undefined,
  }
}
