// domain/finance/measurements.ts — no Prisma import, just constants
export const GOAL_MEASUREMENTS = {
  CHEST_BALANCE: 'chest_balance',
  MONTHLY_DEVIATION_COUNT: 'monthly_deviation_count',
  MONTHLY_DEVIATION_AMOUNT: 'monthly_deviation_amount',
} as const

export type GoalMeasurement = (typeof GOAL_MEASUREMENTS)[keyof typeof GOAL_MEASUREMENTS]