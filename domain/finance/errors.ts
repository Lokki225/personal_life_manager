// An expected business-rule violation, safe to show to the user.
// `field` is the input name the message belongs to, when there is one.
export class FinanceRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'FinanceRuleError'
    this.field = field
  }
}

export const isFinanceRuleError = (error: unknown): error is FinanceRuleError =>
  error instanceof FinanceRuleError
