import {
  financeRepository,
  type BudgetExceptionRecord,
  type BudgetExceptionRepository,
  type CreateBudgetExceptionData,
} from '../../infrastructure/repositories/financeRepository'

export type CreateBudgetExceptionInput = {
  userId: string
  date: Date | string
  plannedAmount: number | string
  actualAmount: number | string
  category: string
  difference?: number | string
  reason?: string | null
  context?: string | null
  resolution?: string | null
}

export async function createBudgetException(
  input: CreateBudgetExceptionInput,
  repository: BudgetExceptionRepository = financeRepository,
): Promise<BudgetExceptionRecord> {
  const { userId, difference, ...rest } = input

  const payload: CreateBudgetExceptionData = {
    date: rest.date,
    plannedAmount: rest.plannedAmount,
    actualAmount: rest.actualAmount,
    difference:
      difference === undefined
        ? Number(rest.actualAmount) - Number(rest.plannedAmount)
        : difference,
    category: rest.category,
    reason: rest.reason ?? undefined,
    context: rest.context ?? undefined,
    resolution: rest.resolution ?? undefined,
  }

  return repository.createBudgetException(userId, payload)
}
