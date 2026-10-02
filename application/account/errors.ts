// An expected account problem, safe to show in a form.
export class AccountRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'AccountRuleError'
    this.field = field
  }
}

export const isAccountRuleError = (error: unknown): error is AccountRuleError => error instanceof AccountRuleError
