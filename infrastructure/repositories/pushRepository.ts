import { prisma } from '../prisma/client'

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string }

export type PushRecipient = {
  id: string
  locale: string | null
  timeZone: string | null
  subscriptions: StoredSubscription[]
}

export interface PushRepository {
  // Remembers a device for a person. A device that was subscribed under
  // another account moves to this one.
  saveSubscription: (userId: string, subscription: StoredSubscription) => Promise<void>
  removeSubscription: (userId: string, endpoint: string) => Promise<void>
  // Forgets a device whatever its owner, once the push service says it is gone.
  forgetEndpoint: (endpoint: string) => Promise<void>
  listSubscriptions: (userId: string) => Promise<StoredSubscription[]>
  // Everyone with at least one device to notify.
  listRecipients: () => Promise<PushRecipient[]>
}

const fields = { endpoint: true, p256dh: true, auth: true }

export const pushRepository: PushRepository = {
  saveSubscription: async (userId: string, subscription: StoredSubscription) => {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId, ...subscription },
      update: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
    })
  },

  removeSubscription: async (userId: string, endpoint: string) => {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
  },

  forgetEndpoint: async (endpoint: string) => {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  },

  listSubscriptions: async (userId: string) => {
    return prisma.pushSubscription.findMany({ where: { userId }, select: fields })
  },

  listRecipients: async () => {
    const users = await prisma.user.findMany({
      where: { pushSubscriptions: { some: {} } },
      select: { id: true, locale: true, timeZone: true, pushSubscriptions: { select: fields } },
    })

    return users.map(({ pushSubscriptions, ...user }) => ({ ...user, subscriptions: pushSubscriptions }))
  },
}
