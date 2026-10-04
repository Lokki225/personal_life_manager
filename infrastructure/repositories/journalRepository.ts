import bcrypt from 'bcryptjs'

import type { JournalLink, JournalType } from '../../domain/personal/journal'
import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Journal entries and their links. The password hash never leaves this file.

const ENTRY_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  mood: true,
  energy: true,
  isSecured: true,
  entryDate: true,
  reviewOn: true,
  createdAt: true,
  updatedAt: true,
  links: { select: { targetType: true, targetId: true } },
} as const

export type EntryData = {
  type: JournalType
  title: string | null
  body: string
  mood: number | null
  energy: number | null
  entryDate: Date
  reviewOn: Date | null
}

const linkRows = (links: JournalLink[]) => links.map(({ targetType, targetId }) => ({ targetType, targetId }))

export const journalRepository = {
  createEntry: async (userId: string, data: EntryData, links: JournalLink[], password: string | null) => {
    return prisma.journalEntry.create({
      data: {
        userId,
        origin: currentOrigin(),
        ...data,
        isSecured: password !== null,
        passwordHash: password === null ? null : await bcrypt.hash(password, 10),
        links: { create: linkRows(links) },
      },
      select: { id: true },
    })
  },

  updateEntry: async (userId: string, id: string, data: EntryData, links: JournalLink[]) => {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.journalEntry.updateMany({ where: { id, userId }, data })
      if (count === 0) return false
      await tx.journalLink.deleteMany({ where: { entryId: id } })
      await tx.journalLink.createMany({ data: linkRows(links).map((link) => ({ ...link, entryId: id })) })
      return true
    })
  },

  // Locks an entry with a password, or opens it for good with null.
  setLock: async (userId: string, id: string, password: string | null) => {
    const { count } = await prisma.journalEntry.updateMany({
      where: { id, userId },
      data: { isSecured: password !== null, passwordHash: password === null ? null : await bcrypt.hash(password, 10) },
    })
    return count > 0
  },

  checkPassword: async (userId: string, id: string, password: string) => {
    const entry = await prisma.journalEntry.findFirst({ where: { id, userId }, select: { passwordHash: true } })
    return Boolean(entry?.passwordHash) && (await bcrypt.compare(password, entry!.passwordHash!))
  },

  getEntry: async (userId: string, id: string) => {
    return prisma.journalEntry.findFirst({ where: { id, userId }, select: ENTRY_SELECT })
  },

  listEntries: async (userId: string, type: JournalType | null) => {
    return prisma.journalEntry.findMany({
      where: { userId, ...(type ? { type } : {}) },
      select: ENTRY_SELECT,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    })
  },

  listLinkedEntries: async (userId: string, targetType: string, targetId: string) => {
    return prisma.journalEntry.findMany({
      where: { userId, links: { some: { targetType, targetId } } },
      select: ENTRY_SELECT,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    })
  },

  deleteEntry: async (userId: string, id: string) => {
    const { count } = await prisma.journalEntry.deleteMany({ where: { id, userId } })
    return count > 0
  },

  // Today's open daily note, if there is one.
  findDailyNote: async (userId: string, day: Date) => {
    return prisma.journalEntry.findFirst({
      where: { userId, type: 'DAILY', entryDate: day, isSecured: false },
      select: ENTRY_SELECT,
      orderBy: { createdAt: 'asc' },
    })
  },

  // The entries about a period, for a review.
  listEntriesBetween: async (userId: string, from: Date, to: Date) => {
    return prisma.journalEntry.findMany({
      where: { userId, entryDate: { gte: from, lt: to } },
      select: ENTRY_SELECT,
      orderBy: { entryDate: 'asc' },
    })
  },

  // What an entry can link to: Personal goals still going, and open tasks.
  linkOptions: async (userId: string) => {
    const [goals, tasks] = await Promise.all([
      prisma.goal.findMany({ where: { userId, domain: 'personal', abandonedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: 'desc' } }),
      prisma.task.findMany({
        where: { userId, status: { in: ['OPEN', 'CARRIED_OVER'] } },
        select: { id: true, title: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])
    return { goals, tasks }
  },

  // Which of these goals and tasks belong to the user, so a link can only
  // point at their own things.
  ownedTargets: async (userId: string, goalIds: string[], taskIds: string[]) => {
    const [goals, tasks] = await Promise.all([
      goalIds.length ? prisma.goal.findMany({ where: { userId, id: { in: goalIds } }, select: { id: true } }) : [],
      taskIds.length ? prisma.task.findMany({ where: { userId, id: { in: taskIds } }, select: { id: true } }) : [],
    ])
    return new Set([...goals.map((g) => `goal:${g.id}`), ...tasks.map((t) => `task:${t.id}`)])
  },
}

export type JournalRepository = typeof journalRepository
export type EntryRecord = NonNullable<Awaited<ReturnType<typeof journalRepository.getEntry>>>
