import { prisma } from '../prisma/client'

export type IncomeRecord = NonNullable<Awaited<ReturnType<typeof prisma.income.findFirst>>>
export type AllocationRecord = NonNullable<Awaited<ReturnType<typeof prisma.allocation.findFirst>>>
export type GoalRecord = NonNullable<Awaited<ReturnType<typeof prisma.goal.findFirst>>>
export type ExpenseRecord = NonNullable<Awaited<ReturnType<typeof prisma.expense.findFirst>>>
export type ExpenseRecordWithProject = ExpenseRecord & {
  project?: {
    id: string
    name: string
  } | null
}
export type MoneyMovementRecordWithChests = MoneyMovementRecord & {
  sourceChest?: { id: string; name: string } | null
  destinationChest?: { id: string; name: string } | null
}

export type ChestRecord = NonNullable<Awaited<ReturnType<typeof prisma.chest.findFirst>>>
export type MoneyMovementRecord = NonNullable<Awaited<ReturnType<typeof prisma.moneyMovement.findFirst>>>
export type GoalConditionRecord = NonNullable<Awaited<ReturnType<typeof prisma.goalCondition.findFirst>>>
export type GoalRecordWithConditions = GoalRecord & {
  conditions: (GoalConditionRecord & { chest?: { id: string; name: string } | null })[]
}
export type BudgetExceptionRecord = NonNullable<Awaited<ReturnType<typeof prisma.budgetException.findFirst>>>

export type CreateIncomeData = {
  source: string
  amount: number | string
  frequency: string
  expectedDate?: Date | string | null
  actualDate?: Date | string | null
  status?: string
  notes?: string | null
  projectId?: string | null
}

export type UpdateIncomeData = Partial<CreateIncomeData>

export type CreateAllocationData = {
  name: string
  amount: number | string
  period: string
  category: string
  startDate: Date | string
  endDate?: Date | string | null
  recurrence?: string | null
  notes?: string | null
}

export type UpdateAllocationData = Partial<CreateAllocationData>

export type CreateExpenseData = {
  amount: number | string
  category: string
  date: Date | string
  allocationId?: string | null
  projectId?: string | null
  description?: string | null
  notes?: string | null
}

export type UpdateExpenseData = Partial<CreateExpenseData>

export type InitialPlanData = {
  income: { source: string; amount: number; frequency: string; payDay: number }
  allocations: { name: string; amount: number; period: string; category: string }[]
  startDate: Date
}

export interface SetupPlanRepository {
  hasIncome: (userId: string) => Promise<boolean>
  // Writes the income and allocations together, or nothing at all.
  // Resolves to false, without writing, when the user already has an income.
  createInitialPlan: (userId: string, plan: InitialPlanData) => Promise<boolean>
}

export type IncomeReceiptRecord = NonNullable<Awaited<ReturnType<typeof prisma.incomeReceipt.findFirst>>>

export type ConfirmIncomeReceiptData = {
  incomeId: string
  amount: number
  periodStart: Date
  periodEnd: Date
  receivedAt: Date
  // What this arrival puts into the chests, given what the month had already
  // received. Savings go to "Monthly Savings" (or the Base Chest when there is
  // none), unallocated income to the Base Chest.
  depositsFor: (receivedBefore: number) => { savings: number; unallocated: number }
}

export interface IncomeReceiptRepository {
  // The receipts counted for the month starting on `periodStart`.
  listIncomeReceipts: (userId: string, periodStart: Date) => Promise<IncomeReceiptRecord[]>
  // Records the arrival and its deposits together, once per income and month.
  // Resolves to false, without writing, when it was already confirmed.
  confirmIncomeReceipt: (userId: string, data: ConfirmIncomeReceiptData) => Promise<boolean>
}

export type DebtRecord = NonNullable<Awaited<ReturnType<typeof prisma.debt.findFirst>>>
export type DebtPaymentRecord = NonNullable<Awaited<ReturnType<typeof prisma.debtPayment.findFirst>>>
export type DebtRecordWithPayments = DebtRecord & {
  payments: DebtPaymentRecord[]
  goal?: { id: string; name: string } | null
}

// The chest side of a debt or of a repayment: money entering or leaving it.
export type DebtMovementData = { type: 'IN' | 'OUT'; chestId: string; notes: string }

export type CreateDebtData = {
  direction: 'BORROWED' | 'LENT'
  counterparty: string
  principal: number
  interestType: 'NONE' | 'PERCENT' | 'FIXED'
  interestValue: number
  takenAt: Date
  dueDate?: Date | null
  goalId?: string | null
}

// Borrowed for a goal: the money goes on from the Debts Chest to the goal's chest.
export type DebtGoalFunding = { goalId: string; chestId: string }

export interface DebtRepository {
  listDebts: (userId: string) => Promise<DebtRecordWithPayments[]>
  // The debt and its chest movements together, or nothing.
  createDebt: (
    userId: string,
    data: CreateDebtData,
    movement?: DebtMovementData | null,
    funding?: DebtGoalFunding | null,
  ) => Promise<DebtRecord>
  // A repayment and its chest movement together, or nothing.
  addDebtPayment: (
    userId: string,
    debtId: string,
    payment: { amount: number; date: Date },
    movement: DebtMovementData,
  ) => Promise<DebtPaymentRecord>
}

export interface IncomeRepository {
  createIncome: (userId: string, data: CreateIncomeData) => Promise<IncomeRecord>
  listIncomes: (userId: string) => Promise<IncomeRecord[]>
  updateIncome: (id: string, data: UpdateIncomeData) => Promise<IncomeRecord>
  deleteIncome: (id: string) => Promise<IncomeRecord>
}

export interface AllocationRepository {
  createAllocation: (userId: string, data: CreateAllocationData) => Promise<AllocationRecord>
  listAllocations: (userId: string) => Promise<AllocationRecord[]>
  updateAllocation: (id: string, data: UpdateAllocationData) => Promise<AllocationRecord>
  deleteAllocation: (id: string) => Promise<AllocationRecord>
}

export interface ExpenseRepository {
  createExpense: (userId: string, data: CreateExpenseData) => Promise<ExpenseRecord>
  listExpenses: (userId: string) => Promise<ExpenseRecordWithProject[]>
  updateExpense: (id: string, data: UpdateExpenseData) => Promise<ExpenseRecord>
  deleteExpense: (id: string) => Promise<ExpenseRecord>
}


export type CreateBudgetExceptionData = {
  date: Date | string
  plannedAmount: number | string
  actualAmount: number | string
  difference: number | string
  category: string
  reason?: string | null
  context?: string | null
  resolution?: string | null
  expenseId?: string | null
}

export type UpdateBudgetExceptionData = Partial<CreateBudgetExceptionData>

export interface BudgetExceptionRepository {
  createBudgetException: (userId: string, data: CreateBudgetExceptionData) => Promise<BudgetExceptionRecord>
  listBudgetExceptions: (userId: string) => Promise<BudgetExceptionRecord[]>
  updateBudgetException: (id: string, data: UpdateBudgetExceptionData) => Promise<BudgetExceptionRecord>
  deleteBudgetException: (id: string) => Promise<BudgetExceptionRecord>
}

export type ProjectRecord = NonNullable<Awaited<ReturnType<typeof prisma.project.findFirst>>>

export type CreateProjectData = {
  name: string
  notes?: string | null
}

export type UpdateProjectData = Partial<CreateProjectData>

export type CreateChestData = {
  name: string
  type: 'AVAILABLE' | 'SECURE'
  isSystem?: boolean
  passwordHash?: string | null
  lockedUntil?: Date | string | null
}

export type UpdateChestData = Partial<Omit<CreateChestData, 'isSystem'>>

export type CreateMovementData = {
  amount: number | string
  type: 'IN' | 'OUT' | 'TRANSFER'
  reason: 'DAILY_SAVING' | 'PLANNED_SAVING' | 'BUFFER_CONSOLIDATION' | 'GOAL_FUNDING' | 'WITHDRAWAL' | 'EXPENSE' | 'DEBT'
  date: Date | string
  sourceChestId?: string | null
  destinationChestId?: string | null
  relatedGoalId?: string | null
  relatedProjectId?: string | null
  notes?: string | null
}

export type CreateGoalConditionData = {
  measurement: string
  chestId?: string | null
  operator: 'GTE' | 'LTE' | 'EQ' | 'GT' | 'LT'
  targetValue: number | string
  unit?: string | null
  period?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
}

export type CreateGoalData = {
  name: string
  domain?: string
  logic?: 'ALL' | 'ANY'
  conditions: CreateGoalConditionData[]
}

export interface ChestRepository {
  createChest: (userId: string, data: CreateChestData) => Promise<ChestRecord>
  listChests: (userId: string) => Promise<ChestRecord[]>
  getChest: (id: string) => Promise<ChestRecord | null>
  updateChest: (id: string, data: UpdateChestData) => Promise<ChestRecord>
  deleteChest: (id: string) => Promise<ChestRecord>
  // Deletes one of the user's chests and unlinks it from past movements, so
  // the balances of the other chests stay exactly as they were.
  removeChest: (userId: string, chestId: string) => Promise<void>
}

export interface MovementRepository {
  createMovement: (userId: string, data: CreateMovementData) => Promise<MoneyMovementRecord>
  listMovements: (userId: string) => Promise<MoneyMovementRecordWithChests[]>
}

export interface GoalRepository {
  createGoal: (userId: string, data: CreateGoalData) => Promise<GoalRecordWithConditions>
  listGoals: (userId: string) => Promise<GoalRecordWithConditions[]>
  getGoal: (id: string) => Promise<GoalRecordWithConditions | null>
  deleteGoal: (id: string) => Promise<GoalRecord>
  // A savings goal in one step: its chest, the goal with its balance
  // condition, and the first contribution. All of it, or nothing.
  createSavingsGoal: (userId: string, data: CreateSavingsGoalData) => Promise<GoalRecord>
}

export type CreateSavingsGoalData = {
  name: string
  targetAmount: number
  alreadySaved: number
  unit: string
}

export interface ProjectRepository {
  createProject: (userId: string, data: CreateProjectData) => Promise<ProjectRecord>
  listProjects: (userId: string) => Promise<ProjectRecord[]>
  updateProject: (id: string, data: UpdateProjectData) => Promise<ProjectRecord>
  deleteProject: (id: string) => Promise<ProjectRecord>
}



const MAX_WRITE_ATTEMPTS = 3

// A transaction that lost a race against a concurrent one. Prisma reports it
// as P2034 on a query, but as a raw driver error when it happens on COMMIT.
function isWriteConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const { code, cause } = error as { code?: unknown; cause?: { kind?: unknown; originalCode?: unknown } }

  return code === 'P2034' || cause?.kind === 'TransactionWriteConflict' || cause?.originalCode === '40001'
}

export const financeRepository: SetupPlanRepository &
  IncomeReceiptRepository &
  DebtRepository &
  IncomeRepository &
  AllocationRepository &
  ExpenseRepository &
  BudgetExceptionRepository &
  ProjectRepository &
  ChestRepository &
  MovementRepository &
  GoalRepository = {
  hasIncome: async (userId: string) => {
    return (await prisma.income.count({ where: { userId } })) > 0
  },

  createInitialPlan: async (userId: string, plan: InitialPlanData) => {
    // Serializable so two saves racing each other cannot both pass the check.
    // The loser of a race is retried: its second attempt sees the real state.
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            if ((await tx.income.count({ where: { userId } })) > 0) {
              return false
            }

            await tx.income.create({ data: { userId, status: 'expected', ...plan.income } })
            await tx.allocation.createMany({
              data: plan.allocations.map((allocation) => ({ userId, startDate: plan.startDate, ...allocation })),
            })

            return true
          },
          { isolationLevel: 'Serializable' },
        )
      } catch (error) {
        if (!isWriteConflict(error) || attempt >= MAX_WRITE_ATTEMPTS) {
          throw error
        }
      }
    }
  },

  listIncomeReceipts: async (userId: string, periodStart: Date) => {
    return prisma.incomeReceipt.findMany({ where: { userId, periodStart } })
  },

  confirmIncomeReceipt: async (userId: string, data: ConfirmIncomeReceiptData) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const receipts = await tx.incomeReceipt.findMany({ where: { userId, periodStart: data.periodStart } })

            if (receipts.some((receipt) => receipt.incomeId === data.incomeId)) {
              return false
            }

            // A month whose deposits were made before incomes were confirmed
            // (no receipt, but planned savings already in) is not paid twice.
            const depositedWithoutReceipt =
              receipts.length === 0 &&
              (await tx.moneyMovement.count({
                where: {
                  userId,
                  reason: 'PLANNED_SAVING',
                  date: { gte: data.periodStart, lte: data.periodEnd },
                },
              })) > 0

            await tx.incomeReceipt.create({
              data: {
                userId,
                incomeId: data.incomeId,
                amount: data.amount,
                periodStart: data.periodStart,
                receivedAt: data.receivedAt,
              },
            })

            if (depositedWithoutReceipt) {
              return true
            }

            const deposits = data.depositsFor(receipts.reduce((total, receipt) => total + Number(receipt.amount), 0))

            let chests = await tx.chest.findMany({ where: { userId } })

            if (!chests.some((chest) => chest.isSystem && chest.name === 'Base Chest')) {
              await tx.chest.createMany({
                data: [
                  { userId, name: 'Base Chest', type: 'AVAILABLE', isSystem: true },
                  { userId, name: 'Buffer', type: 'AVAILABLE', isSystem: true },
                  { userId, name: 'Monthly Savings', type: 'SECURE', isSystem: false },
                  { userId, name: 'Debts Chest', type: 'AVAILABLE', isSystem: true },
                ],
              })
              chests = await tx.chest.findMany({ where: { userId } })
            }

            const baseChest = chests.find((chest) => chest.isSystem && chest.name === 'Base Chest')!
            // Money with no chest of its own always lands in the Base Chest.
            const savingsChest = chests.find((chest) => chest.name === 'Monthly Savings') ?? baseChest

            const movements = [
              { amount: deposits.savings, destinationChestId: savingsChest.id, notes: 'Planned savings' },
              { amount: deposits.unallocated, destinationChestId: baseChest.id, notes: 'Unallocated income' },
            ].filter((movement) => movement.amount >= 1)

            // Written here, not through recordMovement, because the check and
            // the writes must share this transaction.
            await tx.moneyMovement.createMany({
              data: movements.map((movement) => ({
                userId,
                type: 'IN' as const,
                reason: 'PLANNED_SAVING' as const,
                date: data.receivedAt,
                ...movement,
              })),
            })

            return true
          },
          { isolationLevel: 'Serializable' },
        )
      } catch (error) {
        if (!isWriteConflict(error) || attempt >= MAX_WRITE_ATTEMPTS) {
          throw error
        }
      }
    }
  },

  listDebts: async (userId: string) => {
    return prisma.debt.findMany({
      where: { userId },
      include: { payments: { orderBy: { date: 'asc' } }, goal: { select: { id: true, name: true } } },
      orderBy: { takenAt: 'desc' },
    })
  },

  createDebt: async (
    userId: string,
    data: CreateDebtData,
    movement?: DebtMovementData | null,
    funding?: DebtGoalFunding | null,
  ) => {
    return prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({ data: { userId, ...data } })

      if (movement) {
        await tx.moneyMovement.create({
          data: {
            userId,
            amount: data.principal,
            type: movement.type,
            reason: 'DEBT',
            date: data.takenAt,
            notes: movement.notes,
            ...(movement.type === 'IN'
              ? { destinationChestId: movement.chestId }
              : { sourceChestId: movement.chestId }),
          },
        })
      }

      if (movement && funding) {
        await tx.moneyMovement.create({
          data: {
            userId,
            amount: data.principal,
            type: 'TRANSFER',
            reason: 'GOAL_FUNDING',
            date: data.takenAt,
            sourceChestId: movement.chestId,
            destinationChestId: funding.chestId,
            relatedGoalId: funding.goalId,
          },
        })
      }

      return debt
    })
  },

  addDebtPayment: async (
    userId: string,
    debtId: string,
    payment: { amount: number; date: Date },
    movement: DebtMovementData,
  ) => {
    return prisma.$transaction(async (tx) => {
      const created = await tx.debtPayment.create({ data: { debtId, ...payment } })

      await tx.moneyMovement.create({
        data: {
          userId,
          amount: payment.amount,
          type: movement.type,
          reason: 'DEBT',
          date: payment.date,
          notes: movement.notes,
          ...(movement.type === 'IN'
            ? { destinationChestId: movement.chestId }
            : { sourceChestId: movement.chestId }),
        },
      })

      return created
    })
  },

  createIncome: async (userId: string, data: CreateIncomeData) => {
    const createData: Record<string, unknown> = {
      source: data.source,
      amount: Number(data.amount),
      frequency: data.frequency,
      status: data.status ?? 'expected',
      user: { connect: { id: userId } },
    }

    if (data.expectedDate !== undefined && data.expectedDate !== null) {
      createData.expectedDate = data.expectedDate
    }

    if (data.actualDate !== undefined && data.actualDate !== null) {
      createData.actualDate = data.actualDate
    }

    if (data.notes !== undefined && data.notes !== null) {
      createData.notes = data.notes
    }

    if (data.projectId !== undefined && data.projectId !== null) {
      createData.projectId = data.projectId
    }

    return prisma.income.create({
      data: createData as Parameters<typeof prisma.income.create>[0]['data'],
    })
  },

  listIncomes: async (userId: string) => {
    return prisma.income.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  updateIncome: async (id: string, data: UpdateIncomeData) => {
    return prisma.income.update({
      where: { id },
      data: {
        ...data,
        amount: data.amount === undefined ? undefined : Number(data.amount),
      },
    })
  },

  deleteIncome: async (id: string) => {
    return prisma.income.delete({ where: { id } })
  },

  createAllocation: async (userId: string, data: CreateAllocationData) => {
    const createData: Record<string, unknown> = {
      name: data.name,
      amount: Number(data.amount),
      period: data.period,
      category: data.category,
      startDate: data.startDate,
      user: { connect: { id: userId } },
    }

    if (data.endDate !== undefined && data.endDate !== null) {
      createData.endDate = data.endDate
    }

    if (data.recurrence !== undefined && data.recurrence !== null) {
      createData.recurrence = data.recurrence
    }

    if (data.notes !== undefined && data.notes !== null) {
      createData.notes = data.notes
    }

    return prisma.allocation.create({
      data: createData as Parameters<typeof prisma.allocation.create>[0]['data'],
    })
  },

  listAllocations: async (userId: string) => {
    return prisma.allocation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  updateAllocation: async (id: string, data: UpdateAllocationData) => {
    const updateData: Record<string, unknown> = { ...data }

    if (data.amount !== undefined) {
      updateData.amount = Number(data.amount)
    }

    return prisma.allocation.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.allocation.update>[0]['data'],
    })
  },

  deleteAllocation: async (id: string) => {
    return prisma.allocation.delete({ where: { id } })
  },

  createExpense: async (userId: string, data: CreateExpenseData) => {
    const createData: Record<string, unknown> = {
      amount: Number(data.amount),
      category: data.category,
      date: data.date,
      user: { connect: { id: userId } },
    }

    if (data.allocationId !== undefined && data.allocationId !== null) {
      createData.allocationId = data.allocationId
    }

    if (data.projectId !== undefined && data.projectId !== null) {
      createData.projectId = data.projectId
    }

    if (data.description !== undefined && data.description !== null) {
      createData.description = data.description
    }

    if (data.notes !== undefined && data.notes !== null) {
      createData.notes = data.notes
    }

    return prisma.expense.create({
      data: createData as Parameters<typeof prisma.expense.create>[0]['data'],
    })
  },

  listExpenses: async (userId: string) => {
    return prisma.expense.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  },

  updateExpense: async (id: string, data: UpdateExpenseData) => {
    const updateData: Record<string, unknown> = { ...data }

    if (data.amount !== undefined) {
      updateData.amount = Number(data.amount)
    }

    return prisma.expense.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.expense.update>[0]['data'],
    })
  },

  deleteExpense: async (id: string) => {
    return prisma.expense.delete({ where: { id } })
  },


  createBudgetException: async (userId: string, data: CreateBudgetExceptionData) => {
    const createData: Record<string, unknown> = {
      date: data.date,
      plannedAmount: Number(data.plannedAmount),
      actualAmount: Number(data.actualAmount),
      difference: Number(data.difference),
      category: data.category,
      user: { connect: { id: userId } },
    }

    if (data.expenseId) {
      createData.expense = { connect: { id: data.expenseId } }
    }

    if (data.reason !== undefined && data.reason !== null) {
      createData.reason = data.reason
    }

    if (data.context !== undefined && data.context !== null) {
      createData.context = data.context
    }

    if (data.resolution !== undefined && data.resolution !== null) {
      createData.resolution = data.resolution
    }

    return prisma.budgetException.create({
      data: createData as Parameters<typeof prisma.budgetException.create>[0]['data'],
    })
  },

  listBudgetExceptions: async (userId: string) => {
    return prisma.budgetException.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  updateBudgetException: async (id: string, data: UpdateBudgetExceptionData) => {
    const updateData: Record<string, unknown> = { ...data }

    if (data.plannedAmount !== undefined) {
      updateData.plannedAmount = Number(data.plannedAmount)
    }

    if (data.actualAmount !== undefined) {
      updateData.actualAmount = Number(data.actualAmount)
    }

    if (data.difference !== undefined) {
      updateData.difference = Number(data.difference)
    }

    return prisma.budgetException.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.budgetException.update>[0]['data'],
    })
  },

  deleteBudgetException: async (id: string) => {
    return prisma.budgetException.delete({ where: { id } })
  },


  createProject: async (userId: string, data: CreateProjectData) => {
    const createData: Record<string, unknown> = {
      name: data.name,
      user: { connect: { id: userId } },
    }

    if (data.notes !== undefined && data.notes !== null) {
      createData.notes = data.notes
    }

    return prisma.project.create({
      data: createData as Parameters<typeof prisma.project.create>[0]['data'],
    })
  },

  listProjects: async (userId: string) => {
    return prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  updateProject: async (id: string, data: UpdateProjectData) => {
    const updateData: Record<string, unknown> = { ...data }

    return prisma.project.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.project.update>[0]['data'],
    })
  },

  deleteProject: async (id: string) => {
    return prisma.project.delete({ where: { id } })
  },

    createChest: async (userId: string, data: CreateChestData) => {
    const createData: Record<string, unknown> = {
      name: data.name,
      type: data.type,
      isSystem: data.isSystem ?? false,
      user: { connect: { id: userId } },
    }
    if (data.passwordHash !== undefined && data.passwordHash !== null) {
      createData.passwordHash = data.passwordHash
    }
    if (data.lockedUntil !== undefined && data.lockedUntil !== null) {
      createData.lockedUntil = data.lockedUntil
    }
    return prisma.chest.create({
      data: createData as Parameters<typeof prisma.chest.create>[0]['data'],
    })
  },

  listChests: async (userId: string) => {
    return prisma.chest.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  getChest: async (id: string) => {
    return prisma.chest.findUnique({ where: { id } })
  },

  updateChest: async (id: string, data: UpdateChestData) => {
    return prisma.chest.update({
      where: { id },
      data: data as Parameters<typeof prisma.chest.update>[0]['data'],
    })
  },

  deleteChest: async (id: string) => {
    // NOTE: this does not check isSystem — that guard belongs in the
    // use-case layer (application/finance/deleteChest.ts), not here.
    return prisma.chest.delete({ where: { id } })
  },

  removeChest: async (userId: string, chestId: string) => {
    await prisma.$transaction([
      prisma.moneyMovement.updateMany({
        where: { userId, sourceChestId: chestId },
        data: { sourceChestId: null },
      }),
      prisma.moneyMovement.updateMany({
        where: { userId, destinationChestId: chestId },
        data: { destinationChestId: null },
      }),
      prisma.chest.deleteMany({ where: { id: chestId, userId } }),
    ])
  },

  createMovement: async (userId: string, data: CreateMovementData) => {
    const createData: Record<string, unknown> = {
      amount: Number(data.amount),
      type: data.type,
      reason: data.reason,
      date: data.date,
      user: { connect: { id: userId } },
    }
    if (data.sourceChestId) createData.sourceChest = { connect: { id: data.sourceChestId } }
    if (data.destinationChestId) createData.destinationChest = { connect: { id: data.destinationChestId } }
    if (data.relatedGoalId) createData.relatedGoal = { connect: { id: data.relatedGoalId } }
    if (data.relatedProjectId) createData.relatedProject = { connect: { id: data.relatedProjectId } }
    if (data.notes !== undefined && data.notes !== null) createData.notes = data.notes

    return prisma.moneyMovement.create({
      data: createData as Parameters<typeof prisma.moneyMovement.create>[0]['data'],
    })
  },

  listMovements: async (userId: string) => {
    return prisma.moneyMovement.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: {
        sourceChest: { select: { id: true, name: true } },
        destinationChest: { select: { id: true, name: true } },
      },
    })
  },

  createGoal: async (userId: string, data: CreateGoalData) => {
    return prisma.goal.create({
      data: {
        name: data.name,
        domain: data.domain ?? 'finance',
        logic: data.logic ?? 'ALL',
        user: { connect: { id: userId } },
        conditions: {
          create: data.conditions.map((c) => ({
            measurement: c.measurement,
            operator: c.operator,
            targetValue: Number(c.targetValue),
            unit: c.unit ?? null,
            period: c.period ?? 'NONE',
            ...(c.chestId ? { chest: { connect: { id: c.chestId } } } : {}),
          })),
        },
      },
      include: { conditions: { include: { chest: { select: { id: true, name: true } } } } },
    })
  },

  createSavingsGoal: async (userId: string, data: CreateSavingsGoalData) => {
    return prisma.$transaction(async (tx) => {
      const chest = await tx.chest.create({
        data: { userId, name: data.name, type: 'AVAILABLE', isSystem: false },
      })

      const goal = await tx.goal.create({
        data: {
          userId,
          name: data.name,
          domain: 'finance',
          logic: 'ALL',
          conditions: {
            create: [
              {
                measurement: 'chest_balance',
                chestId: chest.id,
                operator: 'GTE',
                targetValue: data.targetAmount,
                unit: data.unit,
              },
            ],
          },
        },
      })

      // Written here, not through recordMovement, because it must share this
      // transaction. It is money entering from outside, so there is no source.
      if (data.alreadySaved > 0) {
        await tx.moneyMovement.create({
          data: {
            userId,
            amount: data.alreadySaved,
            type: 'IN',
            reason: 'GOAL_FUNDING',
            date: new Date(),
            destinationChestId: chest.id,
            relatedGoalId: goal.id,
          },
        })
      }

      return goal
    })
  },

  listGoals: async (userId: string) => {
    return prisma.goal.findMany({
      where: { userId },
      include: { conditions: { include: { chest: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  getGoal: async (id: string) => {
    return prisma.goal.findUnique({
      where: { id },
      include: { conditions: { include: { chest: { select: { id: true, name: true } } } } },
    })
  },

  deleteGoal: async (id: string) => {
    return prisma.goal.delete({ where: { id } })
  },
}
