import { userRepository, type UserRepository } from '../../infrastructure/repositories/userRepository'
import { AccountRuleError } from './errors'

const EMAIL_TAKEN = 'An account already exists for this email. Sign in instead.'

// Creates an account. Emails are stored in lower case, which is also how
// sign-in looks them up.
export async function registerUser(
  input: { email: string; password: string; firstName: string; lastName: string; username?: string | null },
  repository: Pick<UserRepository, 'emailExists' | 'createUser'> = userRepository,
): Promise<{ id: string; email: string }> {
  const email = input.email.trim().toLowerCase()

  if (await repository.emailExists(email)) {
    throw new AccountRuleError(EMAIL_TAKEN, 'email')
  }

  const user = await repository.createUser(email, input.password, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    username: input.username?.trim() || null,
  })

  if (!user) {
    throw new AccountRuleError(EMAIL_TAKEN, 'email')
  }

  return user
}
