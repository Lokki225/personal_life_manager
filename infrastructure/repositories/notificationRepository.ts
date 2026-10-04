import { Prisma } from '@/app/generated/prisma/client'

import { prisma } from '../prisma/client'
import type { StoredSubscription } from './pushRepository'

// Who is told about what, and what was already told.

export type NotificationPreferences = { notifyMoney: boolean; notifyAdmin: boolean }

export type NotifiedPerson = NotificationPreferences & {
  id: string
  locale: string | null
  subscriptions: StoredSubscription[]
}

export interface NotificationRepository {
  // Records that this was sent to this person. Resolves to false when it
  // already was, so it is not sent again.
  claim: (userId: string, key: string) => Promise<boolean>
  // Forgets what was sent before a date.
  prune: (before: Date) => Promise<void>
  person: (userId: string) => Promise<NotifiedPerson | null>
  admins: () => Promise<NotifiedPerson[]>
  preferences: (userId: string) => Promise<NotificationPreferences>
  setPreferences: (userId: string, preferences: Partial<NotificationPreferences>) => Promise<void>
}

const select = {
  id: true,
  locale: true,
  notifyMoney: true,
  notifyAdmin: true,
  pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
} as const

const toPerson = ({
  pushSubscriptions,
  ...person
}: {
  id: string
  locale: string | null
  notifyMoney: boolean
  notifyAdmin: boolean
  pushSubscriptions: StoredSubscription[]
}): NotifiedPerson => ({ ...person, subscriptions: pushSubscriptions })

export const notificationRepository: NotificationRepository = {
  claim: async (userId, key) => {
    try {
      await prisma.notificationLog.create({ data: { userId, key } })
      return true
    } catch (error) {
      // Already sent: the pair (person, key) is unique.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false
      }

      throw error
    }
  },

  prune: async (before) => {
    await prisma.notificationLog.deleteMany({ where: { createdAt: { lt: before } } })
  },

  person: async (userId) => {
    const person = await prisma.user.findUnique({ where: { id: userId }, select })

    return person ? toPerson(person) : null
  },

  admins: async () => {
    return (await prisma.user.findMany({ where: { role: 'ADMIN' }, select })).map(toPerson)
  },

  preferences: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifyMoney: true, notifyAdmin: true } })

    return { notifyMoney: user?.notifyMoney ?? true, notifyAdmin: user?.notifyAdmin ?? true }
  },

  setPreferences: async (userId, preferences) => {
    await prisma.user.updateMany({ where: { id: userId }, data: preferences })
  },
}
