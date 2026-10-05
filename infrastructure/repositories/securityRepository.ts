import { createHash, randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'

import { logSecurityEvent, SECURITY_EVENTS } from '../auth/securityLog'
import { prisma } from '../prisma/client'

const DAY = 24 * 60 * 60 * 1000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export interface SecurityRepository {
  // Counts one attempt under `key`, unless `limit` attempts were already made
  // in the last `windowMs`. Resolves to false when the limit is reached.
  allowAttempt: (key: string, limit: number, windowMs: number, now?: Date) => Promise<boolean>
  // Whether `limit` attempts were already made, without counting a new one.
  isLimited: (key: string, limit: number, windowMs: number, now?: Date) => Promise<boolean>
  recordAttempt: (key: string) => Promise<void>
  findUserByEmail: (email: string) => Promise<{ id: string; email: string; firstName: string | null } | null>
  // Creates a one-time reset secret for the user and gives it back. Only its
  // hash is stored, so it cannot be read again later.
  createResetToken: (userId: string, expiresAt: Date) => Promise<string>
  // Sets the new password if the secret is valid, unused and not expired, and
  // uses up every reset link of that account. Resolves to false otherwise.
  resetPassword: (token: string, newPassword: string, now?: Date) => Promise<boolean>
}

export const securityRepository: SecurityRepository = {
  allowAttempt: async (key: string, limit: number, windowMs: number, now: Date = new Date()) => {
    const recent = await prisma.rateLimitHit.count({
      where: { key, createdAt: { gte: new Date(now.getTime() - windowMs) } },
    })

    if (recent >= limit) {
      // Once a minute per key at most, however long the flood.
      await logSecurityEvent({ kind: SECURITY_EVENTS.limitReached, subject: key }, { once: 60_000 })
      return false
    }

    await prisma.rateLimitHit.create({ data: { key } })
    // Attempts older than a day no longer count for anything.
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } })

    return true
  },

  isLimited: async (key: string, limit: number, windowMs: number, now: Date = new Date()) => {
    const recent = await prisma.rateLimitHit.count({
      where: { key, createdAt: { gte: new Date(now.getTime() - windowMs) } },
    })

    return recent >= limit
  },

  recordAttempt: async (key: string) => {
    await prisma.rateLimitHit.create({ data: { key } })
  },

  findUserByEmail: async (email: string) => {
    return prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true } })
  },

  createResetToken: async (userId: string, expiresAt: Date) => {
    const token = randomBytes(32).toString('base64url')

    await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } })

    return token
  },

  resetPassword: async (token: string, newPassword: string, now: Date = new Date()) => {
    const passwordHash = await bcrypt.hash(newPassword, 10)

    return prisma.$transaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } })

      if (!reset || reset.usedAt !== null || reset.expiresAt <= now) {
        return false
      }

      // Claimed first: a link opened twice at once only works once.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: now },
      })

      if (claimed.count === 0) {
        return false
      }

      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } })
      await tx.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } })

      return true
    })
  },
}
