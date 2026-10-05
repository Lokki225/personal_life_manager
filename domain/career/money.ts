import { DEBTS_CHEST_NAME } from '../finance/chests'

// Career and Finance (Career spec §10). Finance stays the only source of
// truth for money: Career reads it, never stores a second salary.

const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

// An amount per month, from its period.
export function perMonth(amount: number, period: string, reference: Date): number {
  if (period === 'weekly') return (amount / 7) * daysInMonth(reference)
  if (period === 'daily') return amount * daysInMonth(reference)
  return amount
}

// What a position linked to a Finance income is paid per month.
export const incomePerMonth = (income: { amount: number; frequency: string }, reference: Date) =>
  perMonth(income.amount, income.frequency === 'weekly' ? 'weekly' : 'monthly', reference)

export type RunwayInputs = {
  chests: { name: string; isSystem: boolean; type: string; lockedUntil: Date | null; balance: number }[]
  allocations: { amount: number; period: string; category: string }[]
}

// How many months the money at hand would cover what the plan spends:
// available = chests not locked and not the Debts Chest (borrowed money);
// monthly need = the plan's allocations, savings excluded. Shown with both
// inputs: it is a calculation, not a forecast.
export function runway({ chests, allocations }: RunwayInputs, today: Date) {
  const available = chests
    .filter((c) => !(c.isSystem && c.name === DEBTS_CHEST_NAME))
    .filter((c) => !(c.lockedUntil && c.lockedUntil > today))
    .reduce((sum, c) => sum + Math.max(c.balance, 0), 0)
  const monthlyNeed = allocations.filter((a) => a.category !== 'savings').reduce((sum, a) => sum + perMonth(a.amount, a.period, today), 0)

  return {
    available,
    monthlyNeed: Math.round(monthlyNeed),
    // Null when the plan spends nothing: there is nothing to divide by.
    months: monthlyNeed > 0 ? Math.floor((available / monthlyNeed) * 10) / 10 : null,
  }
}
