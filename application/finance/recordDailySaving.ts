import { recordMovement } from "./recordMovement";

export async function recordDailySaving(userId: string, amount: number, destinationChestId: string) {
  return recordMovement({ userId, amount, type: 'IN', reason: 'DAILY_SAVING', destinationChestId })
}
