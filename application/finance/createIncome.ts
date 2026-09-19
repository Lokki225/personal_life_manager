import {
  financeRepository,
  type CreateIncomeData,
  type IncomeRepository,
  type IncomeRecord,
} from '../../infrastructure/repositories/financeRepository'

export type CreateIncomeInput = {
  userId: string
  source: string
  amount: number | string
  frequency: string
  expectedDate?: Date | string | null
  actualDate?: Date | string | null
  status?: string
  notes?: string | null
  projectId?: string | null
}

export async function createIncome(
  input: CreateIncomeInput,
  repository: IncomeRepository = financeRepository,
): Promise<IncomeRecord> {
  const { userId, status = 'expected', ...rest } = input

  const payload: CreateIncomeData = {
    source: rest.source,
    amount: rest.amount,
    frequency: rest.frequency,
    expectedDate: rest.expectedDate ?? undefined,
    actualDate: rest.actualDate ?? undefined,
    status,
    notes: rest.notes ?? undefined,
    projectId: rest.projectId ?? undefined,
  }

  return repository.createIncome(userId, payload)
}
