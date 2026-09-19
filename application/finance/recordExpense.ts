import {
  financeRepository,
  type CreateExpenseData,
  type ExpenseRecord,
  type ExpenseRepository,
} from '../../infrastructure/repositories/financeRepository'

export type RecordExpenseInput = {
  userId: string
  amount: number | string
  category: string
  date: Date | string
  allocationId?: string | null
  projectId?: string | null
  description?: string | null
  notes?: string | null
}

export async function recordExpense(
  input: RecordExpenseInput,
  repository: ExpenseRepository = financeRepository,
): Promise<ExpenseRecord> {
  const { userId, ...rest } = input

  const payload: CreateExpenseData = {
    amount: rest.amount,
    category: rest.category,
    date: rest.date,
    allocationId: rest.allocationId ?? undefined,
    projectId: rest.projectId ?? undefined,
    description: rest.description ?? undefined,
    notes: rest.notes ?? undefined,
  }

  return repository.createExpense(userId, payload)
}
