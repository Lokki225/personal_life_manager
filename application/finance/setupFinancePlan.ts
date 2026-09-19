import { dailyBudget } from '../../domain/finance/calculations'

export type SetupPeriod = 'monthly' | 'weekly'

export type SetupPlanSummaryInput = {
  incomeAmount: number | string
  allocationAmount: number | string
  allocationPeriod: SetupPeriod
  referenceDate?: Date | string
}

export function summarizeSetupPlan({
  incomeAmount,
  allocationAmount,
  allocationPeriod,
  referenceDate = new Date(),
}: SetupPlanSummaryInput) {
  const normalizedIncome = Number(incomeAmount)
  const normalizedAllocation = Number(allocationAmount)

  return {
    incomeAmount: Number.isFinite(normalizedIncome) ? normalizedIncome : 0,
    allocationAmount: Number.isFinite(normalizedAllocation)
      ? normalizedAllocation
      : 0,
    allocationPeriod,
    dailyBudget: dailyBudget(
      Number.isFinite(normalizedAllocation) ? normalizedAllocation : 0,
      allocationPeriod,
      new Date(referenceDate),
    ),
  }
}

