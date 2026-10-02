// prisma/seed.ts
import bcrypt from 'bcryptjs'
import { prisma } from '../infrastructure/prisma/client'
import { financeRepository } from '../infrastructure/repositories/financeRepository'
import { createGoal } from '../application/finance/createGoal'
import { recordMovement } from '../application/finance/recordMovement'
import { GOAL_MEASUREMENTS } from '@/application/finance/measurements'

async function ensureDefaultChests(userId: string) {
  const existing = await financeRepository.listChests(userId)
  if (existing.some((c) => c.name === 'Base Chest')) {
    return existing
  }

  await financeRepository.createChest(userId, { name: 'Base Chest', type: 'AVAILABLE', isSystem: true })
  await financeRepository.createChest(userId, { name: 'Buffer', type: 'AVAILABLE', isSystem: true })
  await financeRepository.createChest(userId, { name: 'Monthly Savings', type: 'SECURE', isSystem: false })

  return financeRepository.listChests(userId)
}

async function main() {
  // --- User ---
  const passwordHash = await bcrypt.hash('changeme123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'franklinlokki@gmail.com' },
    update: {},
    create: {
      email: 'franklinlokki@gmail.com',
      passwordHash,
    },
  })
  console.log(`Seeded user: ${user.email} (password: changeme123 — change after first login)`)

  // --- Default chests (idempotent) ---
  const chests = await ensureDefaultChests(user.id)
  console.log(`Chests ready: ${chests.map((c) => c.name).join(', ')}`)

  // --- Income + allocations, so the dashboard has something to compute ---
  const existingIncomes = await financeRepository.listIncomes(user.id)
  if (existingIncomes.length === 0) {
    await financeRepository.createIncome(user.id, {
      source: 'Salary',
      amount: 300000,
      frequency: 'monthly',
      status: 'received',
      actualDate: new Date(),
    })

    await financeRepository.createAllocation(user.id, {
      name: 'Daily Living',
      amount: 300000,
      period: 'monthly',
      category: 'daily_living',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    })
    console.log('Seeded income + daily living allocation')
  }

  // --- Example goal: "Save 30,000 XOF for headphones" ---
  const existingGoals = await financeRepository.listGoals(user.id)
  if (existingGoals.length === 0) {
    const headphonesChest = await financeRepository.createChest(user.id, {
      name: 'Headphones',
      type: 'AVAILABLE',
      isSystem: false,
    })

    const goal = await createGoal(user.id, {
      name: 'Save 30,000 XOF for headphones',
      domain: 'finance',
      logic: 'ALL',
      conditions: [
        {
          measurement: GOAL_MEASUREMENTS.CHEST_BALANCE,
          chestId: headphonesChest.id,
          operator: 'GTE',
          targetValue: 30000,
          unit: 'XOF',
        },
      ],
    })

    // Seed a partial contribution so the goal has real progress to display,
    // not just 0 — money entering from outside the system.
    await recordMovement({
      userId: user.id,
      amount: 8000,
      type: 'IN',
      reason: 'GOAL_FUNDING',
      destinationChestId: headphonesChest.id,
      relatedGoalId: goal.id,
    })

    console.log(`Seeded goal "${goal.name}" with 8,000 XOF already saved toward 30,000`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })