import type { z } from 'zod'

import { formDataToObject, formDataToValues } from './formData'
import type { FormState } from './formState'

export type ParseResult<T> = { ok: true; data: T } | { ok: false; state: FormState }

export type RuleError = { message: string; field?: string }

type FormHandlerOptions = {
  // Tells an expected rule violation (shown in the form) from a crash (rethrown).
  isRuleError?: (error: unknown) => error is RuleError
}

export class FormHandler<S extends z.ZodType> {
  private readonly schema: S
  private readonly isRuleError?: (error: unknown) => error is RuleError

  constructor(schema: S, options: FormHandlerOptions = {}) {
    this.schema = schema
    this.isRuleError = options.isRuleError
  }

  parse(formData: FormData): ParseResult<z.output<S>> {
    const parsed = this.schema.safeParse(formDataToObject(formData))

    if (parsed.success) {
      return { ok: true, data: parsed.data }
    }

    const fieldErrors: Record<string, string[]> = {}
    const formErrors: string[] = []

    for (const issue of parsed.error.issues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message)
      } else {
        const key = issue.path.map(String).join('.')
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
    }

    return {
      ok: false,
      state: { status: 'error', fieldErrors, formErrors, values: formDataToValues(formData) },
    }
  }

  async submit(formData: FormData, run: (data: z.output<S>) => Promise<void>): Promise<FormState> {
    const result = this.parse(formData)

    if (!result.ok) {
      return result.state
    }

    try {
      await run(result.data)
    } catch (error) {
      if (!this.isRuleError?.(error)) {
        throw error
      }

      return {
        status: 'error',
        fieldErrors: error.field ? { [error.field]: [error.message] } : {},
        formErrors: error.field ? [] : [error.message],
        values: formDataToValues(formData),
      }
    }

    return { status: 'success', fieldErrors: {}, formErrors: [] }
  }
}
