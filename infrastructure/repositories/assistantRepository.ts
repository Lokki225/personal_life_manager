import { prisma } from '../prisma/client'
import type { ApiTokenOwner } from './apiTokenRepository'
import type { StoredSubscription } from './pushRepository'

export type AssistantNoteRecord = { id: string; kind: string; title: string; body: string; createdAt: Date }

// Someone who asked for the assistant's notes, with what writing one needs.
export type NoteRecipient = ApiTokenOwner['user'] & { subscriptions: StoredSubscription[] }

export interface AssistantRepository {
  addNote: (userId: string, note: { kind: string; title: string; body: string }) => Promise<void>
  listNotes: (userId: string, limit: number) => Promise<AssistantNoteRecord[]>
  // Forgets the notes of a person written before a date.
  pruneNotes: (userId: string, before: Date) => Promise<void>
  notesEnabled: (userId: string) => Promise<boolean>
  setNotesEnabled: (userId: string, enabled: boolean) => Promise<void>
  // Everyone who asked for notes and has a plan to write about.
  listNoteRecipients: () => Promise<NoteRecipient[]>
}

export const assistantRepository: AssistantRepository = {
  addNote: async (userId, note) => {
    await prisma.assistantNote.create({ data: { userId, ...note } })
  },

  listNotes: async (userId, limit) => {
    return prisma.assistantNote.findMany({
      where: { userId },
      select: { id: true, kind: true, title: true, body: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  pruneNotes: async (userId, before) => {
    await prisma.assistantNote.deleteMany({ where: { userId, createdAt: { lt: before } } })
  },

  notesEnabled: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { assistantNotes: true } })

    return user?.assistantNotes ?? false
  },

  setNotesEnabled: async (userId, enabled) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { assistantNotes: enabled } })
  },

  listNoteRecipients: async () => {
    const users = await prisma.user.findMany({
      where: { assistantNotes: true, incomes: { some: {} } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        locale: true,
        timeZone: true,
        settledThrough: true,
        bufferSweepDay: true,
        pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
      },
    })

    return users.map(({ pushSubscriptions, ...user }) => ({ ...user, subscriptions: pushSubscriptions }))
  },
}
