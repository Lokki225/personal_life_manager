import { DEBTS_CHEST_NAME } from "@/domain/finance/chests"
import { CreateChestData, financeRepository } from "@/infrastructure/repositories/financeRepository"

// Borrowed money is kept apart from savings, in its own built-in chest.
const debts_chest_data: CreateChestData = {
  name: DEBTS_CHEST_NAME,
  type: 'AVAILABLE',
  isSystem: true
}

export async function ensureDefaultChests(userId: string) {
  const existing = await financeRepository.listChests(userId)

  if (existing.some(c => c.name === 'Base Chest')) {
    // Already set up. Accounts older than the Debts Chest get theirs here.
    if (!existing.some(c => c.isSystem && c.name === DEBTS_CHEST_NAME)) {
      await financeRepository.createChest(userId, debts_chest_data)
    }
    return
  }

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
  await financeRepository.createChest(userId, debts_chest_data)
}
