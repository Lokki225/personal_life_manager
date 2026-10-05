import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTodayTasks, getTaskLists } from '@/application/personal/tasks'
import { prisma } from '@/infrastructure/prisma/client'
import { userRepository } from '@/infrastructure/repositories/userRepository'

// A Career focus item is a shared task, but it belongs to Career: it never
// shows in Personal's lists, counts against the day's capacity, or gets
// carried over by Personal (Career plan, step A). Development database only.

if (/prod/i.test(process.env.VERCEL_ENV ?? '') || process.env.NODE_ENV === 'production') {
  throw new Error('This suite never runs against production.')
}

let userId = ''
const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: `domains-${Date.now()}@example.invalid`, passwordHash: 'x' } })).id
  await prisma.task.createMany({
    data: [
      { userId, title: 'Personal today', dueDate: today },
      { userId, title: 'Personal inbox' },
      { userId, title: 'Career due today', domain: 'career', dueDate: today, focusWeek: today },
      { userId, title: 'Career late', domain: 'career', dueDate: yesterday, focusWeek: yesterday },
      { userId, title: 'Career no date', domain: 'career', focusWeek: today },
    ],
  })
})

afterAll(async () => {
  if (userId) await userRepository.deleteAccount(userId)
  await prisma.$disconnect()
})

describe('Career focus items stay out of Personal', () => {
  it('are not on Personal Today, nor in its load', async () => {
    const { entries, load } = await getTodayTasks(userId, now)
    expect(entries.map((e) => e.task.title)).toEqual(['Personal today'])
    expect(load.planned).toBe(1)
  })

  it('are not in the Personal task lists', async () => {
    const lists = await getTaskLists(userId, now)
    const titles = [...lists.inbox, ...lists.upcoming, ...lists.repeating, ...lists.carried].map((t) => t.title)
    expect(titles.sort()).toEqual(['Personal inbox', 'Personal today'])
  })

  it('are never carried over by Personal', async () => {
    const late = await prisma.task.findFirst({ where: { userId, title: 'Career late' } })
    expect(late).toMatchObject({ dueDate: yesterday, carryCount: 0, status: 'OPEN' })
  })
})
