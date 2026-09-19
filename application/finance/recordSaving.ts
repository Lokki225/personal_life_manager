import {
  financeRepository,
  type CreateSavingData,
  type SavingRecord,
  type SavingRepository,
} from '../../infrastructure/repositories/financeRepository'

export type RecordSavingInput = {
  userId: string
  amount: number | string
  date: Date | string
  source: string
  destination: string
  notes?: string | null
}

export async function recordSaving(
  input: RecordSavingInput,
  repository: SavingRepository = financeRepository,
): Promise<SavingRecord> {
  const { userId, ...rest } = input

  const payload: CreateSavingData = {
    amount: rest.amount,
    date: rest.date,
    source: rest.source,
    destination: rest.destination,
    notes: rest.notes ?? undefined,
  }

  return repository.createSaving(userId, payload)
}
