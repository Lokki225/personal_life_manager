// An expected Personal rule violation, safe to show to the user.
// `field` is the input name the message belongs to, when there is one.
export class PersonalRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'PersonalRuleError'
    this.field = field
  }
}

export const isPersonalRuleError = (error: unknown): error is PersonalRuleError => error instanceof PersonalRuleError
