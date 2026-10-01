export const ALLOCATION_PERIODS = ['monthly', 'weekly'] as const
export const ALLOCATION_CATEGORIES = ['fixed', 'subscription', 'daily_living', 'savings', 'custom'] as const
export const INCOME_FREQUENCIES = ['monthly', 'weekly', 'occasional', 'recurring'] as const

export const EXPENSE_CATEGORIES = ['food', 'transport', 'shopping', 'other'] as const
export const EXCEPTION_CATEGORIES = ['transport', 'food', 'emergency', 'other'] as const

export type AllocationPeriod = (typeof ALLOCATION_PERIODS)[number]
export type AllocationCategory = (typeof ALLOCATION_CATEGORIES)[number]
export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number]
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number]
