import { describe, expect, it, vi } from 'vitest'

import { createResetLink, limitAttempts, requestPasswordReset, resetPassword, TOO_MANY_ATTEMPTS } from './passwordReset'

const now = new Date(2026, 9, 3, 12)
const baseUrl = 'https://app.example'
const message = (link: string, firstName: string | null) => ({ subject: 'Reset', text: `${firstName}: ${link}` })

const depsOf = (overrides: { configured?: boolean; user?: unknown; allow?: boolean | boolean[] } = {}) => {
  const allowAttempt = vi.fn()
  const answers = Array.isArray(overrides.allow) ? overrides.allow : [overrides.allow ?? true]
  answers.forEach((answer) => allowAttempt.mockResolvedValueOnce(answer))
  allowAttempt.mockResolvedValue(answers.at(-1))

  return {
    security: {
      allowAttempt,
      isLimited: vi.fn(),
      recordAttempt: vi.fn(),
      findUserByEmail: vi
        .fn()
        .mockResolvedValue('user' in overrides ? overrides.user : { id: 'user-1', email: 'awa@example.com', firstName: 'Awa' }),
      createResetToken: vi.fn().mockResolvedValue('secret'),
      resetPassword: vi.fn().mockResolvedValue(true),
    },
    email: { isConfigured: () => overrides.configured ?? true, send: vi.fn().mockResolvedValue(true) },
  }
}

const request = { email: ' Awa@Example.com ', ip: '1.2.3.4', baseUrl, message }

describe('limitAttempts', () => {
  it('counts the attempt, and refuses once there were too many', async () => {
    const allowed = { allowAttempt: vi.fn().mockResolvedValue(true) }
    await limitAttempts('signUp', '1.2.3.4', allowed)
    expect(allowed.allowAttempt).toHaveBeenCalledWith('signUp:1.2.3.4', 5, 60 * 60 * 1000)

    await expect(limitAttempts('signUp', '1.2.3.4', { allowAttempt: vi.fn().mockResolvedValue(false) })).rejects.toThrow(
      TOO_MANY_ATTEMPTS,
    )
  })
})

describe('requestPasswordReset', () => {
  it('emails a one-hour link to the account’s address', async () => {
    const deps = depsOf()

    await requestPasswordReset(request, deps, now)

    expect(deps.security.findUserByEmail).toHaveBeenCalledWith('awa@example.com')
    expect(deps.security.createResetToken).toHaveBeenCalledWith('user-1', new Date(2026, 9, 3, 13))
    expect(deps.email.send).toHaveBeenCalledWith({
      to: 'awa@example.com',
      subject: 'Reset',
      text: 'Awa: https://app.example/reset-password?token=secret',
    })
  })

  it('answers the same way and sends nothing when there is no such account', async () => {
    const deps = depsOf({ user: null })

    await expect(requestPasswordReset(request, deps, now)).resolves.toBeUndefined()
    expect(deps.security.createResetToken).not.toHaveBeenCalled()
    expect(deps.email.send).not.toHaveBeenCalled()
  })

  it('stays silent when one email is asked for too often, but tells a flooding address', async () => {
    const perEmail = depsOf({ allow: [true, false] })
    await expect(requestPasswordReset(request, perEmail, now)).resolves.toBeUndefined()
    expect(perEmail.email.send).not.toHaveBeenCalled()

    await expect(requestPasswordReset(request, depsOf({ allow: false }), now)).rejects.toThrow(TOO_MANY_ATTEMPTS)
  })

  it('creates nothing when email is not set up', async () => {
    const deps = depsOf({ configured: false })

    await requestPasswordReset(request, deps, now)

    expect(deps.security.findUserByEmail).not.toHaveBeenCalled()
    expect(deps.security.createResetToken).not.toHaveBeenCalled()
  })
})

describe('createResetLink', () => {
  it('gives an administrator a link that works for a day', async () => {
    const security = { createResetToken: vi.fn().mockResolvedValue('secret') }

    await expect(createResetLink({ role: 'ADMIN' }, 'user-1', baseUrl, security, now)).resolves.toBe(
      'https://app.example/reset-password?token=secret',
    )
    expect(security.createResetToken).toHaveBeenCalledWith('user-1', new Date(2026, 9, 4, 12))
  })

  it('is refused to anyone else', async () => {
    const security = { createResetToken: vi.fn() }

    await expect(createResetLink({ role: 'USER' }, 'user-1', baseUrl, security, now)).rejects.toThrow(
      'Only an administrator can do this.',
    )
    expect(security.createResetToken).not.toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  const input = { token: 'secret', password: 'new-secret', ip: '1.2.3.4' }

  it('sets the new password with a valid link', async () => {
    const security = { allowAttempt: vi.fn().mockResolvedValue(true), resetPassword: vi.fn().mockResolvedValue(true) }

    await resetPassword(input, security)

    expect(security.resetPassword).toHaveBeenCalledWith('secret', 'new-secret')
  })

  it('refuses an expired or used link, and too many tries', async () => {
    await expect(
      resetPassword(input, { allowAttempt: vi.fn().mockResolvedValue(true), resetPassword: vi.fn().mockResolvedValue(false) }),
    ).rejects.toThrow('This link has expired or was already used. Ask for a new one.')

    const flooded = { allowAttempt: vi.fn().mockResolvedValue(false), resetPassword: vi.fn() }
    await expect(resetPassword(input, flooded)).rejects.toThrow(TOO_MANY_ATTEMPTS)
    expect(flooded.resetPassword).not.toHaveBeenCalled()
  })
})
