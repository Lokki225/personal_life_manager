import { prisma } from '../prisma/client'

export type FeedbackRecord = {
  id: string
  rating: number | null
  kind: string
  message: string
  createdAt: Date
  readAt: Date | null
  author: { firstName: string | null; lastName: string | null; username: string | null; email: string }
}

export interface FeedbackRepository {
  addFeedback: (userId: string, feedback: { rating: number | null; kind: string; message: string }) => Promise<void>
  setWantsNews: (userId: string, wantsNews: boolean) => Promise<void>
  wantsNews: (userId: string) => Promise<boolean>
  listFeedback: (limit: number) => Promise<FeedbackRecord[]>
  // How many opinions were left, their average rating, and how many are unread.
  summary: () => Promise<{ count: number; averageRating: number | null; unread: number }>
  markAllRead: (at: Date) => Promise<void>
  // Who asked to hear about what is new.
  listNewsReaders: () => Promise<{ firstName: string | null; lastName: string | null; username: string | null; email: string }[]>
}

const author = { select: { firstName: true, lastName: true, username: true, email: true } }

export const feedbackRepository: FeedbackRepository = {
  addFeedback: async (userId, feedback) => {
    await prisma.feedback.create({ data: { userId, ...feedback } })
  },

  setWantsNews: async (userId, wantsNews) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { wantsNews } })
  },

  wantsNews: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { wantsNews: true } })

    return user?.wantsNews ?? false
  },

  listFeedback: async (limit) => {
    const rows = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, rating: true, kind: true, message: true, createdAt: true, readAt: true, user: author },
    })

    return rows.map(({ user, ...feedback }) => ({ ...feedback, author: user }))
  },

  summary: async () => {
    const [all, unread] = await Promise.all([
      prisma.feedback.aggregate({ _count: { _all: true }, _avg: { rating: true } }),
      prisma.feedback.count({ where: { readAt: null } }),
    ])

    return { count: all._count._all, averageRating: all._avg.rating, unread }
  },

  markAllRead: async (at) => {
    await prisma.feedback.updateMany({ where: { readAt: null }, data: { readAt: at } })
  },

  listNewsReaders: async () => {
    return prisma.user.findMany({
      where: { wantsNews: true },
      select: { firstName: true, lastName: true, username: true, email: true },
      orderBy: { createdAt: 'asc' },
    })
  },
}
