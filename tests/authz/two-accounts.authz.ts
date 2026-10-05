import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fundGoal } from '@/application/finance/fundGoal'
import { confirmIncome, depositSetupMonth } from '@/application/finance/confirmIncome'
import { recordChestExpense } from '@/application/finance/chestExpense'
import { createChest } from '@/application/finance/createChest'
import { createSavingsGoal } from '@/application/finance/createSavingsGoal'
import { recordDebt, repayDebt } from '@/application/finance/debts'
import { deleteChest } from '@/application/finance/deleteChest'
import { ensureDefaultChests } from '@/application/finance/ensureDefaultChests'
import { editExpense, removeExpense } from '@/application/finance/manageExpense'
import { removeAllocation, removeIncome, saveAllocation, saveIncome } from '@/application/finance/managePlan'
import { recordDailyExpense } from '@/application/finance/recordDailyExpense'
import { transferBetweenChests } from '@/application/finance/transferBetweenChests'
import { getBadges } from '@/application/nav/badges'
import {
  abandonGoal,
  addGoalTask,
  addMilestone,
  createPersonalGoal,
  getPersonalGoal,
  logGoalValue,
} from '@/application/personal/goals'
import {
  createEntry,
  deleteEntry,
  getEntry,
  lockEntry,
  removeLock,
  unlockEntry,
  updateEntry,
} from '@/application/personal/journal'
import { deleteSession, logSession, startSession } from '@/application/personal/sessions'
import { syncSeries } from '@/application/personal/sync'
import { addTask, deleteTask, dropTask, scheduleTask, setCarryReason, setTaskDone } from '@/application/personal/tasks'
import { prisma } from '@/infrastructure/prisma/client'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'
import { createTranslator } from '@/lib/i18n/translate'

// User A records one thing of every kind; user B, signed in as themselves,
// tries every action on A's ids. Each attempt must fail and leave A's data as
// it was. Runs against the development database: `npm run test:authz`.

if (/prod/i.test(process.env.VERCEL_ENV ?? '') || process.env.NODE_ENV === 'production') {
  throw new Error('The authorization suite never runs against production.')
}

const stamp = Date.now()
const a: Record<string, string> = {}
let userA = ''
let userB = ''

async function newUser(name: string) {
  const user = await prisma.user.create({ data: { email: `authz-${name}-${stamp}@example.invalid`, passwordHash: 'x' } })
  return user.id
}

// Everything one test user recorded, in an order the foreign keys accept.
async function removeUser(userId: string) {
  if (!userId) return
  await prisma.journalEntry.deleteMany({ where: { userId } })
  await prisma.session.deleteMany({ where: { userId } })
  await prisma.task.deleteMany({ where: { userId } })
  await prisma.metricSeries.deleteMany({ where: { userId } })
  await prisma.syncConnector.deleteMany({ where: { userId } })
  await prisma.moneyMovement.deleteMany({ where: { userId } })
  await prisma.debtPayment.deleteMany({ where: { debt: { userId } } })
  await prisma.debt.deleteMany({ where: { userId } })
  await prisma.incomeReceipt.deleteMany({ where: { userId } })
  await prisma.income.deleteMany({ where: { userId } })
  await prisma.budgetException.deleteMany({ where: { userId } })
  await prisma.expense.deleteMany({ where: { userId } })
  await prisma.allocation.deleteMany({ where: { userId } })
  await prisma.goal.deleteMany({ where: { userId } })
  await prisma.chest.deleteMany({ where: { userId } })
  await prisma.category.deleteMany({ where: { userId } })
  await prisma.user.delete({ where: { id: userId } })
}

// B's attempt must fail, whatever the error.
const refused = async (attempt: () => Promise<unknown>) => {
  await expect(attempt()).rejects.toBeTruthy()
}

beforeAll(async () => {
  userA = await newUser('a')
  userB = await newUser('b')
  const now = new Date()

  // --- A's Finance ---
  await financeRepository.createInitialPlan(userA, {
    income: { source: 'Salary', amount: 300000, frequency: 'monthly', payDay: 25 },
    allocations: [{ name: 'Daily living', amount: 60000, period: 'monthly', category: 'daily_living' }],
    startDate: now,
  })
  await depositSetupMonth(userA, now)
  await ensureDefaultChests(userA)
  await ensureDefaultChests(userB)
  a.income = (await financeRepository.listIncomes(userA))[0].id
  a.allocation = (await financeRepository.listAllocations(userA))[0].id
  a.chest = (await createChest(userA, { name: 'Holidays', type: 'AVAILABLE' })).id
  a.baseChest = (await financeRepository.listChests(userA)).find((c) => c.name === 'Base Chest')!.id
  await recordDailyExpense({ userId: userA, amount: 500, category: 'food', description: 'Lunch' })
  a.expense = (await financeRepository.listExpenses(userA))[0].id
  await createSavingsGoal(userA, { name: 'Phone', targetAmount: 100000, alreadySaved: 1000 })
  a.goal = (await financeRepository.listGoals(userA))[0].id
  await recordDebt({ userId: userA, direction: 'BORROWED', counterparty: 'Awa', amount: 5000, interestType: 'NONE' })
  a.debt = (await financeRepository.listDebts(userA))[0].id

  // --- A's Personal ---
  a.task = (await addTask(userA, { title: 'Call home', dueDate: now, recurrence: null, categoryId: null })).id
  a.personalGoal = (
    await createPersonalGoal(userA, { preset: 'milestones', name: 'Japanese', horizon: 'YEAR', deadline: null, categoryId: null, milestones: ['Kana'] }, now)
  ).id
  a.outcomeGoal = (
    await createPersonalGoal(userA, { preset: 'outcome', name: 'Rating', horizon: 'YEAR', deadline: null, categoryId: null, newSeries: { label: 'Rating', unit: null }, target: 10 }, now)
  ).id
  a.session = (await logSession(userA, { minutes: 20, goalId: null, note: null, endedAt: now })).id
  a.entry = (await createEntry(userA, { type: 'FREE', title: 'Mine', body: 'Private text', mood: null, energy: null, entryDate: now, reviewOn: null, password: null })).id
  a.lockedEntry = (
    await createEntry(userA, { type: 'FREE', title: 'Locked', body: 'Very private', mood: null, energy: null, entryDate: now, reviewOn: null, password: 'open sesame' })
  ).id
  a.series = (await prisma.metricSeries.findFirst({ where: { userId: userA } }))!.id
})

afterAll(async () => {
  await removeUser(userA)
  await removeUser(userB)
  await prisma.$disconnect()
})

describe('Finance: B cannot touch A’s records', () => {
  it('cannot edit, delete or confirm A’s plan', async () => {
    await refused(() => saveIncome(userB, { id: a.income, source: 'Hacked', amount: 1, payDay: 1 }))
    await refused(() => removeIncome(userB, a.income))
    await refused(() => confirmIncome({ userId: userB, incomeId: a.income, amount: 1 }))
    await refused(() => saveAllocation(userB, { id: a.allocation, name: 'Hacked', amount: 1, period: 'monthly', category: 'fixed' }))
    await refused(() => removeAllocation(userB, a.allocation))

    const income = await prisma.income.findUnique({ where: { id: a.income } })
    const allocation = await prisma.allocation.findUnique({ where: { id: a.allocation } })
    expect(income?.source).toBe('Salary')
    expect(allocation?.name).toBe('Daily living')
  })

  it('cannot edit or delete A’s expense', async () => {
    await refused(() => editExpense(userB, { id: a.expense, amount: 1, category: 'food' }))
    await refused(() => removeExpense(userB, a.expense))
    expect(Number((await prisma.expense.findUnique({ where: { id: a.expense } }))?.amount)).toBe(500)
  })

  it('cannot move, spend from, delete or fund through A’s chests and goals', async () => {
    const own = (await financeRepository.listChests(userB)).find((c) => c.name === 'Base Chest')!.id
    await refused(() => transferBetweenChests(userB, a.baseChest, own, 100, 'WITHDRAWAL'))
    await refused(() => transferBetweenChests(userB, own, a.chest, 100, 'WITHDRAWAL'))
    await refused(() => recordChestExpense({ userId: userB, chestId: a.baseChest, amount: 100, category: 'food' }))
    await refused(() => deleteChest(userB, a.chest))
    await refused(() => fundGoal(userB, a.goal, 100, own))
    await refused(() => recordDebt({ userId: userB, direction: 'BORROWED', counterparty: 'X', amount: 100, interestType: 'NONE', goalId: a.goal }))
    await refused(() => repayDebt({ userId: userB, debtId: a.debt, amount: 100, chestId: own }))

    expect(await prisma.chest.findUnique({ where: { id: a.chest } })).not.toBeNull()
    expect(await prisma.moneyMovement.count({ where: { OR: [{ sourceChestId: a.baseChest }, { destinationChestId: a.chest }], userId: userB } })).toBe(0)
    expect(await prisma.debtPayment.count({ where: { debtId: a.debt } })).toBe(0)
  })
})

describe('Personal: B cannot touch A’s records', () => {
  it('cannot tick, move, drop, delete or explain A’s task', async () => {
    await refused(() => setTaskDone(userB, a.task, true))
    await refused(() => setCarryReason(userB, a.task, 'no_time'))
    await refused(() => scheduleTask(userB, a.task, null))
    await refused(() => dropTask(userB, a.task))
    await refused(() => deleteTask(userB, a.task))

    const task = await prisma.task.findUnique({ where: { id: a.task }, include: { completions: true } })
    expect(task).toMatchObject({ status: 'OPEN', carryReason: null })
    expect(task?.completions).toEqual([])
  })

  it('cannot read or change A’s goals', async () => {
    expect(await getPersonalGoal(userB, a.personalGoal)).toBeNull()
    await refused(() => addGoalTask(userB, a.personalGoal, { title: 'x', dueDate: null, recurrence: null, categoryId: null }))
    await refused(() => addMilestone(userB, a.personalGoal, 'x'))
    await refused(() => abandonGoal(userB, a.personalGoal, 'x'))
    await refused(() => logGoalValue(userB, a.outcomeGoal, 99))
    await refused(() => startSession(userB, a.personalGoal))
    await refused(() => logSession(userB, { minutes: 10, goalId: a.personalGoal, note: null, endedAt: new Date() }))
    await refused(() => syncSeries(userB, a.series))

    expect((await prisma.goal.findUnique({ where: { id: a.personalGoal } }))?.abandonedAt).toBeNull()
    expect(await prisma.milestone.count({ where: { goalId: a.personalGoal } })).toBe(1)
    expect(await prisma.metricEntry.count({ where: { seriesId: a.series } })).toBe(0)
  })

  it('cannot delete A’s session', async () => {
    await refused(() => deleteSession(userB, a.session))
    expect(await prisma.session.findUnique({ where: { id: a.session } })).not.toBeNull()
  })

  it('cannot read, change, lock, unlock or delete A’s journal entries', async () => {
    expect(await getEntry(userB, a.entry, () => true)).toBeNull()
    expect(await getEntry(userB, a.lockedEntry, () => true)).toBeNull()
    const input = { type: 'FREE' as const, title: null, body: 'Hacked', mood: null, energy: null, entryDate: new Date(), reviewOn: null }
    await refused(() => updateEntry(userB, a.entry, input, true))
    await refused(() => deleteEntry(userB, a.entry, true))
    await refused(() => lockEntry(userB, a.entry, 'guessable'))
    await refused(() => unlockEntry(userB, a.lockedEntry, 'open sesame'))
    await refused(() => removeLock(userB, a.lockedEntry, 'open sesame'))

    const entry = await prisma.journalEntry.findUnique({ where: { id: a.entry } })
    const locked = await prisma.journalEntry.findUnique({ where: { id: a.lockedEntry } })
    expect(entry).toMatchObject({ body: 'Private text', isSecured: false })
    expect(locked?.isSecured).toBe(true)
  })

  it('cannot link B’s entry to A’s goal or task', async () => {
    const own = await createEntry(userB, {
      type: 'FREE',
      title: null,
      body: `About @[Japanese](goal:${a.personalGoal}) and @[Call](task:${a.task})`,
      mood: null,
      energy: null,
      entryDate: new Date(),
      reviewOn: null,
      password: null,
    })
    expect(await prisma.journalLink.count({ where: { entryId: own.id } })).toBe(0)
  })
})

describe('Shared views', () => {
  it('give B only B’s own numbers', async () => {
    const badges = await getBadges(userB, () => true, createTranslator('en'), new Date())
    expect(badges.personal).toBe('0 tasks open')
  })
})
