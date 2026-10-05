import { prisma } from '../prisma/client'

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'

// Ids of actions already received from devices' outboxes.
export const syncReceiptRepository = {
  // True when the action is new and now claimed; false when it was received before.
  claim: async (id: string, userId: string, action: string) => {
    try {
      await prisma.syncReceipt.create({ data: { id, userId, action } })
      return true
    } catch (error) {
      if (isUniqueViolation(error)) return false
      throw error
    }
  },

  // Gives the id back when its action failed, so a later try can run it.
  release: async (id: string, userId: string) => {
    await prisma.syncReceipt.deleteMany({ where: { id, userId } })
  },

  prune: async (before: Date) => {
    await prisma.syncReceipt.deleteMany({ where: { createdAt: { lt: before } } })
  },
}

export type SyncReceiptRepository = typeof syncReceiptRepository
