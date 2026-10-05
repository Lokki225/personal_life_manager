import { securityEventRepository, type SecurityEventInput } from '../repositories/securityEventRepository'

// The kinds of security events, as stored.
export const SECURITY_EVENTS = {
  signInFailed: 'signIn.failed',
  signInBlocked: 'signIn.blocked',
  limitReached: 'limit.reached',
  unlockFailed: 'journal.unlockFailed',
  credentialsChanged: 'account.credentialsChanged',
  deleteRefused: 'account.deleteRefused',
  accountDeleted: 'account.deleted',
} as const

// Writes one security event. A failure to write is reported in the server
// logs and nothing else: it must never stop a sign-in or a save.
export async function logSecurityEvent(event: SecurityEventInput, options: { once?: number } = {}) {
  try {
    // With `once`, the same kind for the same subject is written at most once
    // in that many milliseconds.
    if (options.once && (await securityEventRepository.recordedSince(event.kind, event.subject ?? null, new Date(Date.now() - options.once)))) {
      return
    }
    await securityEventRepository.record(event)
  } catch (error) {
    console.error('Could not write a security event', event.kind, error)
  }
}
