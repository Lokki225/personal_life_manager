// An expected Career rule violation, safe to show to the user.
// `field` is the input name the message belongs to, when there is one.
export class CareerRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'CareerRuleError'
    this.field = field
  }
}

export const isCareerRuleError = (error: unknown): error is CareerRuleError => error instanceof CareerRuleError
