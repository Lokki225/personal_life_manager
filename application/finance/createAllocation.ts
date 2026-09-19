import {
  financeRepository,
  type AllocationRecord,
  type AllocationRepository,
  type CreateAllocationData,
} from '../../infrastructure/repositories/financeRepository'

export type CreateAllocationInput = {
  userId: string
  name: string
  amount: number | string
  period: string
  category: string
  startDate: Date | string
  endDate?: Date | string | null
  recurrence?: string | null
  notes?: string | null
}

export async function createAllocation(
  input: CreateAllocationInput,
  repository: AllocationRepository = financeRepository,
): Promise<AllocationRecord> {
  const { userId, ...rest } = input

  const payload: CreateAllocationData = {
    name: rest.name,
    amount: rest.amount,
    period: rest.period,
    category: rest.category,
    startDate: rest.startDate,
    endDate: rest.endDate ?? undefined,
    recurrence: rest.recurrence ?? undefined,
    notes: rest.notes ?? undefined,
  }

  return repository.createAllocation(userId, payload)
}

export async function getCurrentAllocations(
  userId: string,
  today: Date = new Date(),
  repository: AllocationRepository = financeRepository,
): Promise<AllocationRecord[]> {
  const allocations = await repository.listAllocations(userId)
  const currentDate = new Date(today)

  return allocations.filter((allocation) => {
    const startDate = new Date(allocation.startDate)
    const endDate = allocation.endDate ? new Date(allocation.endDate) : null

    return startDate <= currentDate && (!endDate || endDate >= currentDate)
  })
}
