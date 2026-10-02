import { describe, expect, it } from 'vitest'

import {
  budgetDaysInPeriod,
  dailyBudget,
  dailyLivingBudget,
  dailySaving,
  expectedSpendToDate,
  formatAmount,
  monthlyLivingBudget,
  planDeposits,
  receiptDeposits,
  expenseOverages,
  planChestMoves,
  incomePayDate,
  isIncomeDue,
  isUncoveredDay,
  uncoveredDayBudget,
  splitReserveDraw,
  debtTotal,
  debtOutstanding,
  daysInPeriod,
  formatCurrency,
  getDailyFinanceStatus,
  overspending,
  remainingAllocation,
} from './calculations'

describe('finance calculations', () => {
  it('uses the real number of days in a month', () => {
    expect(daysInPeriod('monthly', new Date(2026, 1, 1))).toBe(28)
    expect(daysInPeriod('monthly', new Date(2024, 1, 1))).toBe(29)
    expect(daysInPeriod('monthly', new Date(2026, 0, 1))).toBe(31)
  })

  it('calculates the daily budget based on the period length', () => {
    expect(dailyBudget(300000, 'monthly', new Date(2026, 1, 1))).toBe(10714.285714285714)
    expect(dailyBudget(7000, 'weekly', new Date(2026, 5, 1))).toBe(1000)
  })

  it('spreads a monthly budget over at most 30 days', () => {
    expect(budgetDaysInPeriod('monthly', new Date(2026, 9, 1))).toBe(30)
    expect(budgetDaysInPeriod('monthly', new Date(2026, 8, 1))).toBe(30)
    expect(budgetDaysInPeriod('monthly', new Date(2026, 1, 1))).toBe(28)
    expect(budgetDaysInPeriod('weekly', new Date(2026, 9, 1))).toBe(7)

    expect(dailyBudget(60000, 'monthly', new Date(2026, 9, 1))).toBe(2000)
    expect(dailyBudget(60000, 'monthly', new Date(2026, 8, 1))).toBe(2000)
  })

  it('derives the daily budget from daily living allocations only', () => {
    const allocations = [
      { amount: 60000, period: 'monthly' as const, category: 'daily_living' },
      { amount: 100000, period: 'monthly' as const, category: 'fixed' },
      { amount: 20000, period: 'weekly' as const, category: 'savings' },
    ]

    expect(dailyLivingBudget(allocations, new Date(2026, 8, 21))).toBe(2000)
    expect(
      dailyLivingBudget(
        [...allocations, { amount: 7000, period: 'weekly' as const, category: 'daily_living' }],
        new Date(2026, 8, 21),
      ),
    ).toBe(3000)
    expect(dailyLivingBudget([], new Date(2026, 8, 21))).toBe(0)
  })

  it('rounds the daily budget down to whole units', () => {
    const allocation = { amount: 50000, period: 'monthly' as const, category: 'daily_living' }

    expect(dailyLivingBudget([allocation], new Date(2026, 8, 21))).toBe(1666)
  })

  it('gives the month budget of the daily living allocations', () => {
    const monthly = { amount: 60000, period: 'monthly' as const, category: 'daily_living' }
    const weekly = { amount: 7000, period: 'weekly' as const, category: 'daily_living' }
    const rent = { amount: 100000, period: 'monthly' as const, category: 'fixed' }

    expect(monthlyLivingBudget([monthly, rent], new Date(2026, 9, 1))).toBe(60000)
    expect(monthlyLivingBudget([weekly], new Date(2026, 8, 1))).toBe(30000)
    expect(monthlyLivingBudget([], new Date(2026, 8, 1))).toBe(0)
  })

  it('tells how much of the month budget should be used by a given day', () => {
    expect(expectedSpendToDate(60000, new Date(2026, 8, 15))).toBe(30000)
    expect(expectedSpendToDate(60000, new Date(2026, 9, 31))).toBe(60000)
    expect(expectedSpendToDate(56000, new Date(2026, 1, 14))).toBe(28000)
  })

  it('splits a month of income into planned savings and what is left unallocated', () => {
    const plan = {
      incomes: [{ amount: 300000, frequency: 'monthly' }],
      allocations: [
        { amount: 100000, period: 'monthly' as const, category: 'fixed' },
        { amount: 60000, period: 'monthly' as const, category: 'daily_living' },
        { amount: 7000, period: 'weekly' as const, category: 'savings' },
      ],
    }

    // September has 30 days: the weekly 7,000 is 30,000 over the month.
    expect(planDeposits(plan, new Date(2026, 8, 1))).toEqual({ savings: 30000, unallocated: 110000 })
  })

  it('leaves 109,500 for the Base Chest from 300,000 with 90,500 allocated and 100,000 saved', () => {
    const plan = {
      incomes: [{ amount: 300000, frequency: 'monthly' }],
      allocations: [
        { amount: 60000, period: 'monthly' as const, category: 'daily_living' },
        { amount: 30500, period: 'monthly' as const, category: 'fixed' },
        { amount: 100000, period: 'monthly' as const, category: 'savings' },
      ],
    }

    expect(planDeposits(plan, new Date(2026, 9, 1))).toEqual({ savings: 100000, unallocated: 109500 })
  })

  it('never deposits more than the income covers', () => {
    const plan = {
      incomes: [{ amount: 50000, frequency: 'monthly' }],
      allocations: [
        { amount: 60000, period: 'monthly' as const, category: 'savings' },
        { amount: 20000, period: 'monthly' as const, category: 'fixed' },
      ],
    }

    expect(planDeposits(plan, new Date(2026, 8, 1))).toEqual({ savings: 50000, unallocated: 0 })
    expect(planDeposits({ incomes: [], allocations: [] }, new Date(2026, 8, 1))).toEqual({
      savings: 0,
      unallocated: 0,
    })
  })

  it('deposits a confirmed income by filling savings first, across several arrivals', () => {
    const allocations = [
      { amount: 100000, period: 'monthly' as const, category: 'fixed' },
      { amount: 60000, period: 'monthly' as const, category: 'daily_living' },
      { amount: 20000, period: 'monthly' as const, category: 'savings' },
    ]
    const september = new Date(2026, 8, 15)

    expect(receiptDeposits(allocations, 0, 300000, september)).toEqual({ savings: 20000, unallocated: 120000 })
    // A first part that only covers part of the plan, then the rest.
    expect(receiptDeposits(allocations, 0, 150000, september)).toEqual({ savings: 20000, unallocated: 0 })
    expect(receiptDeposits(allocations, 150000, 150000, september)).toEqual({ savings: 0, unallocated: 120000 })
    // Less than usual never deposits more than arrived.
    expect(receiptDeposits(allocations, 0, 12000, september)).toEqual({ savings: 12000, unallocated: 0 })
  })

  it('moves money between chests so they match a changed plan', () => {
    const balances = { savings: 0, base: 190000 }
    const placed = { savings: 0, unallocated: 190000 }

    // Nothing changed.
    expect(planChestMoves({ target: placed, placed, balances })).toEqual([])
    // A 100,000 savings allocation was added: it comes out of the Base Chest.
    expect(planChestMoves({ target: { savings: 100000, unallocated: 90000 }, placed, balances })).toEqual([
      { kind: 'toSavings', amount: 100000 },
    ])
    // A 20,000 bill was added: that money is no longer free.
    expect(planChestMoves({ target: { savings: 0, unallocated: 170000 }, placed, balances })).toEqual([
      { kind: 'out', amount: 20000 },
    ])
    // Both at once, with a Base Chest that only holds 50,000.
    expect(
      planChestMoves({ target: { savings: 100000, unallocated: 70000 }, placed, balances: { savings: 0, base: 50000 } }),
    ).toEqual([{ kind: 'toSavings', amount: 50000 }])
    // Without a savings chest, the Base Chest holds both.
    expect(
      planChestMoves({ target: { savings: 100000, unallocated: 70000 }, placed, balances, oneChest: true }),
    ).toEqual([{ kind: 'out', amount: 20000 }])
  })

  it('finds how much of each expense went over what was left of the day', () => {
    expect(expenseOverages(2000, [1500, 800, 300])).toEqual([0, 300, 300])
    expect(expenseOverages(2000, [500, 500])).toEqual([0, 0])
    expect(expenseOverages(0, [400])).toEqual([400])
    expect(expenseOverages(-500, [400])).toEqual([400])
  })

  it('expects an income on its pay day, or on the last day of a shorter month', () => {
    expect(incomePayDate(25, new Date(2026, 8, 3))).toEqual(new Date(2026, 8, 25))
    expect(incomePayDate(31, new Date(2026, 1, 3))).toEqual(new Date(2026, 1, 28))
    expect(incomePayDate(0, new Date(2026, 8, 3))).toEqual(new Date(2026, 8, 1))
  })

  it('asks to confirm an income from its pay day, but not before a month after setup', () => {
    const setUpOn = new Date(2026, 9, 1, 15)

    // Set up on 1 October with pay day 1: nothing in October, then 1 November.
    expect(isIncomeDue(1, setUpOn, new Date(2026, 9, 1, 16))).toBe(false)
    expect(isIncomeDue(1, setUpOn, new Date(2026, 9, 31))).toBe(false)
    expect(isIncomeDue(1, setUpOn, new Date(2026, 10, 1, 8))).toBe(true)
    // Pay day 25: 25 October is less than a month after setup, 25 November is not.
    expect(isIncomeDue(25, setUpOn, new Date(2026, 9, 26))).toBe(false)
    expect(isIncomeDue(25, setUpOn, new Date(2026, 10, 24))).toBe(false)
    expect(isIncomeDue(25, setUpOn, new Date(2026, 10, 25, 8))).toBe(true)
  })

  it('funds the 31st from the reserves: in full, in part, or not at all', () => {
    expect(isUncoveredDay(new Date(2026, 9, 31))).toBe(true)
    expect(isUncoveredDay(new Date(2026, 9, 30))).toBe(false)

    expect(uncoveredDayBudget(2000, 5000, 0)).toBe(2000)
    expect(uncoveredDayBudget(2000, 700, 0)).toBe(700)
    expect(uncoveredDayBudget(2000, 0, 0)).toBe(0)
    expect(uncoveredDayBudget(2000, -300, 0)).toBe(0)
    // Spending part of it leaves the day's budget where it was.
    expect(uncoveredDayBudget(2000, 200, 500)).toBe(700)
  })

  it('draws from the Buffer before the Base Chest, and never more than they hold', () => {
    expect(splitReserveDraw(500, { buffer: 800, base: 1000 })).toEqual({ fromBuffer: 500, fromBase: 0 })
    expect(splitReserveDraw(1500, { buffer: 800, base: 1000 })).toEqual({ fromBuffer: 800, fromBase: 700 })
    expect(splitReserveDraw(1500, { buffer: -50, base: 1000 })).toEqual({ fromBuffer: 0, fromBase: 1000 })
  })

  it('adds flat interest to a debt and tracks what is still owed', () => {
    expect(debtTotal(50000, 'NONE', 10)).toBe(50000)
    expect(debtTotal(50000, 'PERCENT', 10)).toBe(55000)
    expect(debtTotal(50000, 'FIXED', 2500)).toBe(52500)

    expect(debtOutstanding(55000, [])).toBe(55000)
    expect(debtOutstanding(55000, [20000, 5000])).toBe(30000)
    expect(debtOutstanding(55000, [60000])).toBe(0)
  })

  it('formats amounts as whole units', () => {
    expect(formatAmount(60000)).toBe('60,000')
    expect(formatAmount(1935.48)).toBe('1,935')
    expect(formatAmount(Number.NaN)).toBe('0')
  })

  it('tracks remaining allocation, saving and overspend correctly', () => {
    expect(remainingAllocation(2000, 1600)).toBe(400)
    expect(dailySaving(2000, 1600)).toBe(400)
    expect(overspending(3500, 2000)).toBe(1500)
  })

  it('formats values in the local XOF currency', () => {
    expect(formatCurrency(1500)).toBe('XOF 1,500.00')
    expect(formatCurrency(0)).toBe('XOF 0.00')
  })

  it('classifies the daily finance state as safe, caution, or overspent', () => {
    expect(getDailyFinanceStatus(500, 200)).toMatchObject({
      label: 'Safe',
      tone: 'emerald',
      message: 'You can still save XOF 300.00 today.',
    })

    expect(getDailyFinanceStatus(500, 450)).toMatchObject({
      label: 'Caution',
      tone: 'amber',
      message: 'You are close to today’s budget. XOF 50.00 remains.',
    })

    expect(getDailyFinanceStatus(500, 650)).toMatchObject({
      label: 'Overspent',
      tone: 'rose',
      message: 'You are over your daily budget by XOF 150.00.',
    })
  })
})
