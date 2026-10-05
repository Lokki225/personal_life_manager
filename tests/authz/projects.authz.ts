import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createLifeArea } from '@/application/lifeAreas/areas'
import { createProject, getProject, listProjects, moveProject, updateProject } from '@/application/projects/projects'
import { prisma } from '@/infrastructure/prisma/client'
import { userRepository } from '@/infrastructure/repositories/userRepository'

// Projects spec scenarios 1, 4 and 7, end to end on the development database.

if (/prod/i.test(process.env.VERCEL_ENV ?? '') || process.env.NODE_ENV === 'production') {
  throw new Error('This suite never runs against production.')
}

let a = ''
let b = ''
const ids: Record<string, string> = {}
const now = new Date()

const input = (name: string, extra: object = {}) => ({ name, summary: null, kind: 'SOFTWARE' as const, primaryDomain: 'personal' as const, lifeAreaId: null, startedAt: null, ...extra })

beforeAll(async () => {
  a = (await prisma.user.create({ data: { email: `projects-a-${Date.now()}@example.invalid`, passwordHash: 'x' } })).id
  b = (await prisma.user.create({ data: { email: `projects-b-${Date.now()}@example.invalid`, passwordHash: 'x' } })).id

  // A project made in Finance before projects were shared, with an expense.
  ids.finance = (await prisma.project.create({ data: { userId: a, name: 'Old Finance project', slug: null } })).id
  await prisma.expense.create({ data: { userId: a, amount: 60000, category: 'other', date: now, projectId: ids.finance, description: 'Studio day' } })

  ids.odo = (await createProject(a, input('OdO'), [{ label: 'Repository', url: 'https://example.com/odo' }])).id
  ids.goal = (await prisma.goal.create({ data: { userId: a, name: '1,000 users', domain: 'personal', projectId: ids.odo } })).id
  const session = (extra: object) =>
    prisma.session.create({ data: { userId: a, startedAt: now, endedAt: now, durationMin: 60, ...extra } })
  await session({ projectId: ids.odo, goalId: ids.goal })
  await session({ goalId: ids.goal })
  await session({ projectId: ids.odo })

  ids.bProject = (await createProject(b, input('B work'), [])).id
})

afterAll(async () => {
  for (const user of [a, b]) if (user) await userRepository.deleteAccount(user)
  await prisma.$disconnect()
})

describe('scenario 1: one list', () => {
  it('shows a project made in Finance, with its expenses, without entering anything again', async () => {
    const list = await listProjects(a, now)
    expect(list.map((p) => p.name).sort()).toEqual(['OdO', 'Old Finance project'])

    const page = (await getProject(a, ids.finance, now))!
    expect(page.money).toMatchObject({ spent: 60000, earned: 0, net: -60000 })
    expect(page.finance.expenses.map((e) => e.description)).toEqual(['Studio day'])
  })
})

describe('scenario 4: time without double counting', () => {
  it('counts each session once, whether linked to the project, its goal, or both', async () => {
    const page = (await getProject(a, ids.odo, now))!
    expect(page.hours).toBe(3)
    expect(page.sessions).toHaveLength(3)
    expect(page.goals.map((g) => g.name)).toEqual(['1,000 users'])
    expect(page.momentum).toEqual({ kind: 'active' })
  })
})

describe('projects', () => {
  it('get a unique URL name and a first status entry', async () => {
    const twin = (await createProject(a, input('OdO'), [])).id
    const rows = await prisma.project.findMany({ where: { id: { in: [ids.odo, twin] } }, select: { slug: true } })
    expect(rows.map((r) => r.slug).sort()).toEqual(['odo', 'odo-2'])
    expect(await prisma.projectStatusChange.count({ where: { projectId: twin, from: null, to: 'ACTIVE' } })).toBe(1)
  })

  it('keep their status history, and archiving says why', async () => {
    await expect(moveProject(a, ids.odo, 'ARCHIVED', null)).rejects.toMatchObject({ field: 'reason' })
    await moveProject(a, ids.odo, 'PAUSED', null)
    await moveProject(a, ids.odo, 'ACTIVE', null)
    const page = (await getProject(a, ids.odo, now))!
    expect(page.statusChanges.map((c) => c.to)).toEqual(['ACTIVE', 'PAUSED', 'ACTIVE'])
  })
})

describe('scenario 7: isolation', () => {
  const refused = async (attempt: () => Promise<unknown>) => expect(attempt()).rejects.toBeTruthy()

  it('B cannot read or change A’s projects, nor put B’s in A’s life area', async () => {
    expect((await listProjects(b, now)).map((p) => p.id)).toEqual([ids.bProject])
    expect(await getProject(b, ids.odo, now)).toBeNull()
    await refused(() => updateProject(b, ids.odo, input('Hacked'), []))
    await refused(() => moveProject(b, ids.odo, 'ARCHIVED', 'x'))
    const area = (await createLifeArea(a, { name: 'Tech', statement: null, color: null, icon: null })).id
    await refused(() => updateProject(b, ids.bProject, input('B work', { lifeAreaId: area }), []))
    await refused(() => createProject(b, input('x', { lifeAreaId: area }), []))

    expect(await prisma.project.findUnique({ where: { id: ids.odo } })).toMatchObject({ name: 'OdO' })
    expect(await prisma.projectStatusChange.count({ where: { projectId: ids.odo, to: 'ARCHIVED' } })).toBe(0)
  })
})
