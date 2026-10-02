import { isEmailConfigured, sendEmail } from '../../infrastructure/email/sendEmail'
import { securityRepository, type SecurityRepository } from '../../infrastructure/repositories/securityRepository'
import type { UserRole } from '../../infrastructure/repositories/userRepository'
import { AccountRuleError } from './errors'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// A link sent by email is used within the hour. One handed over by an
// administrator may wait until the person is free.
const EMAIL_LINK_LIFETIME = HOUR
const ADMIN_LINK_LIFETIME = 24 * HOUR

// How many attempts are allowed, and over how long.
export const LIMITS = {
  signUp: { limit: 5, windowMs: HOUR },
  resetRequest: { limit: 5, windowMs: HOUR },
  resetPerEmail: { limit: 3, windowMs: HOUR },
  resetAttempt: { limit: 10, windowMs: HOUR },
  // Wrong passwords for one email.
  signIn: { limit: 10, windowMs: 15 * MINUTE },
} as const

export const TOO_MANY_ATTEMPTS = 'Too many attempts. Wait a while and try again.'

type Deps = {
  security: SecurityRepository
  email: { isConfigured: () => boolean; send: typeof sendEmail }
}

const defaultDeps: Deps = {
  security: securityRepository,
  email: { isConfigured: isEmailConfigured, send: sendEmail },
}

const resetLink = (baseUrl: string, token: string) => `${baseUrl}/reset-password?token=${token}`

// Counts an attempt and refuses once there were too many. `who` is whatever
// tells people apart: an address on the network, an email.
export async function limitAttempts(
  kind: keyof typeof LIMITS,
  who: string,
  security: Pick<SecurityRepository, 'allowAttempt'> = securityRepository,
): Promise<void> {
  const { limit, windowMs } = LIMITS[kind]

  if (!(await security.allowAttempt(`${kind}:${who}`, limit, windowMs))) {
    throw new AccountRuleError(TOO_MANY_ATTEMPTS)
  }
}

// Whether a reset link can be sent by email at all.
export const canEmailResetLinks = (deps: Pick<Deps, 'email'> = defaultDeps) => deps.email.isConfigured()

// Someone forgot their password. If the email belongs to an account, a link
// is sent to it. The answer is the same either way, so this cannot be used to
// find out who has an account.
export async function requestPasswordReset(
  input: { email: string; ip: string; baseUrl: string; message: (link: string, firstName: string | null) => { subject: string; text: string } },
  deps: Deps = defaultDeps,
  now: Date = new Date(),
): Promise<void> {
  const email = input.email.trim().toLowerCase()

  await limitAttempts('resetRequest', input.ip, deps.security)

  if (!deps.email.isConfigured()) {
    return
  }

  const user = await deps.security.findUserByEmail(email)

  // The per-email limit is silent: saying "too many" would reveal the account.
  if (!user || !(await deps.security.allowAttempt(`resetPerEmail:${email}`, LIMITS.resetPerEmail.limit, LIMITS.resetPerEmail.windowMs))) {
    return
  }

  const token = await deps.security.createResetToken(user.id, new Date(now.getTime() + EMAIL_LINK_LIFETIME))
  const { subject, text } = input.message(resetLink(input.baseUrl, token), user.firstName)

  await deps.email.send({ to: user.email, subject, text })
}

// An administrator creates a reset link to hand to someone themselves, by
// message or in person. It is shown once and works for a day.
export async function createResetLink(
  actor: { role: UserRole },
  userId: string,
  baseUrl: string,
  security: Pick<SecurityRepository, 'createResetToken'> = securityRepository,
  now: Date = new Date(),
): Promise<string> {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError('Only an administrator can do this.')
  }

  const token = await security.createResetToken(userId, new Date(now.getTime() + ADMIN_LINK_LIFETIME))

  return resetLink(baseUrl, token)
}

// Chooses a new password with the secret from a reset link.
export async function resetPassword(
  input: { token: string; password: string; ip: string },
  security: Pick<SecurityRepository, 'allowAttempt' | 'resetPassword'> = securityRepository,
): Promise<void> {
  await limitAttempts('resetAttempt', input.ip, security)

  if (!(await security.resetPassword(input.token, input.password))) {
    throw new AccountRuleError('This link has expired or was already used. Ask for a new one.')
  }
}
