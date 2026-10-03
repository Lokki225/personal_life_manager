import { prisma } from '../prisma/client'
import type { ApiTokenOwner } from './apiTokenRepository'
import type { StoredSubscription } from './pushRepository'

export type AssistantNoteRecord = { id: string; kind: string; title: string; body: string; createdAt: Date }

// Someone who asked for the assistant's notes, with what writing one needs.
export type NoteRecipient = ApiTokenOwner['user'] & {
  assistantProvider: string | null
  assistantName: string | null
  assistantInstructions: string | null
  subscriptions: StoredSubscription[]
}

export type AssistantSettings = {
  notes: boolean
  provider: string | null
  assistantName: string | null
  assistantInstructions: string | null
}

export interface AssistantRepository {
  addNote: (userId: string, note: { kind: string; title: string; body: string }) => Promise<void>
  listNotes: (userId: string, limit: number) => Promise<AssistantNoteRecord[]>
  // Forgets the notes of a person written before a date.
  pruneNotes: (userId: string, before: Date) => Promise<void>
  settings: (userId: string) => Promise<AssistantSettings>
  setNotesEnabled: (userId: string, enabled: boolean) => Promise<void>
  setProvider: (userId: string, provider: string) => Promise<void>
  setPersona: (userId: string, persona: { name: string | null; instructions: string | null }) => Promise<void>
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

  settings: async (userId) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { assistantNotes: true, assistantProvider: true, assistantName: true, assistantInstructions: true },
    })

    return {
      notes: user?.assistantNotes ?? false,
      provider: user?.assistantProvider ?? null,
      assistantName: user?.assistantName ?? null,
      assistantInstructions: user?.assistantInstructions ?? null,
    }
  },

  setNotesEnabled: async (userId, enabled) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { assistantNotes: enabled } })
  },

  setProvider: async (userId, provider) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { assistantProvider: provider } })
  },

  setPersona: async (userId, persona) => {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { assistantName: persona.name, assistantInstructions: persona.instructions },
    })
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
        assistantProvider: true,
        assistantName: true,
        assistantInstructions: true,
        pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
      },
    })

    return users.map(({ pushSubscriptions, ...user }) => ({ ...user, subscriptions: pushSubscriptions }))
  },
}
