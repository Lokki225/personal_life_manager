import { CreateChestData, financeRepository } from "@/infrastructure/repositories/financeRepository"

export async function ensureDefaultChests(userId: string) {
  const existing = await financeRepository.listChests(userId)
  if (existing.some(c => c.name === 'Base Chest')) return // already set up

  const chest_data_one: CreateChestData = {
    name: 'Base Chest',
    type: 'AVAILABLE',
    isSystem: true
  }

  const chest_data_two: CreateChestData = {
    name: 'Buffer',
    type: 'AVAILABLE',
    isSystem: true
  }

  const chest_data_three: CreateChestData = {
    name: 'Monthly Savings',
    type: 'SECURE',
    isSystem: false
  }

  await financeRepository.createChest(userId, chest_data_one)
  await financeRepository.createChest(userId, chest_data_two)
  await financeRepository.createChest(userId, chest_data_three)
}
