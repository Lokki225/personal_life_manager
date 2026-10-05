import { prisma } from '../prisma/client'

export type SecurityEventInput = { kind: string; userId?: string | null; subject?: string | null; detail?: string | null }

const cap = (text: string | null | undefined, max: number) => (text ? text.slice(0, max) : null)

export const securityEventRepository = {
  record: async (event: SecurityEventInput) => {
    await prisma.securityEvent.create({
      data: { kind: event.kind, userId: event.userId ?? null, subject: cap(event.subject, 254), detail: cap(event.detail, 500) },
    })
  },

  // Whether the same event was already written since `since`, to keep one
  // flood from writing a row per request.
  recordedSince: async (kind: string, subject: string | null, since: Date) =>
    (await prisma.securityEvent.count({ where: { kind, subject, createdAt: { gte: since } } })) > 0,

  recent: async (limit: number) => prisma.securityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),

  countsSince: async (since: Date) => {
    const rows = await prisma.securityEvent.groupBy({ by: ['kind'], where: { createdAt: { gte: since } }, _count: { _all: true } })
    return rows.map((row) => ({ kind: row.kind, count: row._count._all }))
  },

  prune: async (before: Date) => {
    await prisma.securityEvent.deleteMany({ where: { createdAt: { lt: before } } })
  },
}

export type SecurityEventRepository = typeof securityEventRepository
