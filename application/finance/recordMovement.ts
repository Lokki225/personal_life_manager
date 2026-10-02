import { now as clockNow } from '../../lib/clock'
import { MovementReason } from "@/app/generated/prisma/enums"
import {
  financeRepository,
  type CreateMovementData,
  type MovementRepository,
} from "@/infrastructure/repositories/financeRepository"

export async function recordMovement(input: {
  userId: string
  amount: number
  type: 'IN' | 'OUT' | 'TRANSFER'
  reason: MovementReason
  sourceChestId?: string
  destinationChestId?: string
  relatedGoalId?: string
  relatedProjectId?: string
  notes?: string
}, repository: Pick<MovementRepository, 'createMovement'> = financeRepository) {
  if (input.amount <= 0) throw new Error('Movement amount must be positive')
  if (input.type === 'TRANSFER' && (!input.sourceChestId || !input.destinationChestId)) {
    throw new Error('Transfer requires both a source and destination chest')
  }
  const data: CreateMovementData = {
    amount: input.amount,
    type: input.type,
    reason: input.reason,
    date: clockNow(),
    sourceChestId: input.sourceChestId,
    destinationChestId: input.destinationChestId,
    relatedGoalId: input.relatedGoalId,
    relatedProjectId: input.relatedProjectId,
    notes: input.notes,
  }
  return repository.createMovement(input.userId, data)
}
