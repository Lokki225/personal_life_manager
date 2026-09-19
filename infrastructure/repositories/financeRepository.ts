import { prisma } from '../prisma/client'

export type IncomeRecord = NonNullable<Awaited<ReturnType<typeof prisma.income.findFirst>>>
export type AllocationRecord = NonNullable<Awaited<ReturnType<typeof prisma.allocation.findFirst>>>
export type ExpenseRecord = NonNullable<Awaited<ReturnType<typeof prisma.expense.findFirst>>>
export type ExpenseRecordWithProject = ExpenseRecord & {
  project?: {
    id: string
    name: string
  } | null
}
export type SavingRecord = NonNullable<Awaited<ReturnType<typeof prisma.saving.findFirst>>>
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

export type CreateSavingData = {
  amount: number | string
  date: Date | string
  source: string
  destination: string
  notes?: string | null
}

export type UpdateSavingData = Partial<CreateSavingData>

export interface SavingRepository {
  createSaving: (userId: string, data: CreateSavingData) => Promise<SavingRecord>
  listSavings: (userId: string) => Promise<SavingRecord[]>
  updateSaving: (id: string, data: UpdateSavingData) => Promise<SavingRecord>
  deleteSaving: (id: string) => Promise<SavingRecord>
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
}

export type UpdateBudgetExceptionData = Partial<CreateBudgetExceptionData>

export interface BudgetExceptionRepository {
  createBudgetException: (userId: string, data: CreateBudgetExceptionData) => Promise<BudgetExceptionRecord>
  listBudgetExceptions: (userId: string) => Promise<BudgetExceptionRecord[]>
  updateBudgetException: (id: string, data: UpdateBudgetExceptionData) => Promise<BudgetExceptionRecord>
  deleteBudgetException: (id: string) => Promise<BudgetExceptionRecord>
}

export type FinancialGoalRecord = NonNullable<Awaited<ReturnType<typeof prisma.financialGoal.findFirst>>>
export type ProjectRecord = NonNullable<Awaited<ReturnType<typeof prisma.project.findFirst>>>

export type CreateFinancialGoalData = {
  name: string
  targetAmount: number | string
  currentAmount?: number | string
}

export type UpdateFinancialGoalData = Partial<CreateFinancialGoalData>

export interface FinancialGoalRepository {
  createFinancialGoal: (userId: string, data: CreateFinancialGoalData) => Promise<FinancialGoalRecord>
  listFinancialGoals: (userId: string) => Promise<FinancialGoalRecord[]>
  updateFinancialGoal: (id: string, data: UpdateFinancialGoalData) => Promise<FinancialGoalRecord>
  deleteFinancialGoal: (id: string) => Promise<FinancialGoalRecord>
}

export type CreateProjectData = {
  name: string
  notes?: string | null
}

export type UpdateProjectData = Partial<CreateProjectData>

export interface ProjectRepository {
  createProject: (userId: string, data: CreateProjectData) => Promise<ProjectRecord>
  listProjects: (userId: string) => Promise<ProjectRecord[]>
  updateProject: (id: string, data: UpdateProjectData) => Promise<ProjectRecord>
  deleteProject: (id: string) => Promise<ProjectRecord>
}

export const financeRepository: IncomeRepository &
  AllocationRepository &
  ExpenseRepository &
  SavingRepository &
  BudgetExceptionRepository &
  FinancialGoalRepository &
  ProjectRepository = {
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

  createSaving: async (userId: string, data: CreateSavingData) => {
    const createData: Record<string, unknown> = {
      amount: Number(data.amount),
      date: data.date,
      source: data.source,
      destination: data.destination,
      user: { connect: { id: userId } },
    }

    if (data.notes !== undefined && data.notes !== null) {
      createData.notes = data.notes
    }

    return prisma.saving.create({
      data: createData as Parameters<typeof prisma.saving.create>[0]['data'],
    })
  },

  listSavings: async (userId: string) => {
    return prisma.saving.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  updateSaving: async (id: string, data: UpdateSavingData) => {
    const updateData: Record<string, unknown> = { ...data }

    if (data.amount !== undefined) {
      updateData.amount = Number(data.amount)
    }

    return prisma.saving.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.saving.update>[0]['data'],
    })
  },

  deleteSaving: async (id: string) => {
    return prisma.saving.delete({ where: { id } })
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

  createFinancialGoal: async (userId: string, data: CreateFinancialGoalData) => {
    const createData: Record<string, unknown> = {
      name: data.name,
      targetAmount: Number(data.targetAmount),
      currentAmount: Number(data.currentAmount ?? 0),
      user: { connect: { id: userId } },
    }

    return prisma.financialGoal.create({
      data: createData as Parameters<typeof prisma.financialGoal.create>[0]['data'],
    })
  },

  listFinancialGoals: async (userId: string) => {
    return prisma.financialGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  updateFinancialGoal: async (id: string, data: UpdateFinancialGoalData) => {
    const updateData: Record<string, unknown> = { ...data }

    if (data.targetAmount !== undefined) {
      updateData.targetAmount = Number(data.targetAmount)
    }

    if (data.currentAmount !== undefined) {
      updateData.currentAmount = Number(data.currentAmount)
    }

    return prisma.financialGoal.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.financialGoal.update>[0]['data'],
    })
  },

  deleteFinancialGoal: async (id: string) => {
    return prisma.financialGoal.delete({ where: { id } })
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
}
