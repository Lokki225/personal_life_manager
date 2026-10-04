import { describe, expect, it } from 'vitest'

import { chestBalance } from '@/domain/finance/chests'

import { evaluateGroup } from './engine'
import { GOAL_MEASUREMENTS, lifecycleFor, measurementOf, toEngineCondition, toFinanceCondition, type FinanceCondition } from './financeGoals'
import { budgetSpendingPoints, chestBalancePoints, financeResolver, savingsInPoints, totalSavings, type FinanceEvidence } from './financeSources'

const condition = (measurement: FinanceCondition['measurement'], extra: Partial<FinanceCondition> = {}): FinanceCondition => ({
  id: `c-${measurement}`,
  measurement,
  chestId: measurement === 'chest_balance' ? 'chest-1' : null,
  category: measurement === 'monthly_category_spending' ? 'food' : null,
  operator: measurement === 'chest_balance' ? 'GTE' : 'LTE',
  targetValue: 100,
  unit: 'XOF',
  ...extra,
})

describe('Finance measurements in the engine', () => {
  it('round-trips every measurement', () => {
    for (const measurement of Object.values(GOAL_MEASUREMENTS)) {
      const original = condition(measurement)
      const engine = { ...toEngineCondition(original), id: original.id }
      expect(toFinanceCondition(engine)).toEqual(original)
    }
  })

  it('maps as the migration does', () => {
    expect(toEngineCondition(condition('chest_balance'))).toMatchObject({
      source: 'CHEST_BALANCE',
      sourceRef: { chestId: 'chest-1' },
      aggregation: 'LATEST',
      window: { type: 'ALL_TIME' },
    })
    expect(toEngineCondition(condition('monthly_deviation_count'))).toMatchObject({
      source: 'BUDGET_EXCEPTIONS',
      aggregation: 'COUNT',
      window: { type: 'CALENDAR', unit: 'month' },
    })
    expect(toEngineCondition(condition('monthly_deviation_amount'))).toMatchObject({ aggregation: 'SUM' })
  })

  it('does not take another node’s condition for a Finance one', () => {
    expect(measurementOf({ source: 'SESSIONS', aggregation: 'COUNT', window: { type: 'CALENDAR', unit: 'week' } })).toBeNull()
    expect(measurementOf({ source: 'BUDGET_EXCEPTIONS', aggregation: 'COUNT', window: { type: 'CALENDAR', unit: 'week' } })).toBeNull()
  })

  it('makes month-by-month goals ongoing and the others terminal', () => {
    expect(lifecycleFor([condition('chest_balance'), condition('total_savings'), condition('debt_owed')])).toBe('TERMINAL')
    expect(lifecycleFor([condition('chest_balance'), condition('monthly_deviation_count')])).toBe('ONGOING')
    expect(lifecycleFor([condition('monthly_saved')])).toBe('ONGOING')
  })

  it('tells spending in all from spending in one category', () => {
    expect(toFinanceCondition({ ...toEngineCondition(condition('monthly_spending')), id: 'x' }).measurement).toBe('monthly_spending')
    expect(toFinanceCondition({ ...toEngineCondition(condition('monthly_category_spending')), id: 'x' })).toMatchObject({
      measurement: 'monthly_category_spending',
      category: 'food',
    })
  })
})

describe('chestBalancePoints', () => {
  it('ends on the chest balance, whatever order the movements come in', () => {
    const movements = [
      { sourceChestId: null, destinationChestId: 'a', amount: 500, date: new Date(2026, 9, 3) },
      { sourceChestId: 'a', destinationChestId: 'b', amount: 200, date: new Date(2026, 9, 1) },
      { sourceChestId: 'b', destinationChestId: null, amount: 50, date: new Date(2026, 9, 2) },
      { sourceChestId: null, destinationChestId: 'a', amount: 75, date: new Date(2026, 9, 3) },
    ]

    expect(chestBalancePoints('a', movements).map((p) => p.value)).toEqual([-200, 300, 375])
    expect(chestBalancePoints('a', movements).at(-1)?.value).toBe(chestBalance('a', movements))
    expect(chestBalancePoints('none', movements)).toEqual([])
  })
})

// The evaluator Finance used before the engine, kept here to prove the engine
// gives the same answers.
function legacyEvaluate(
  goal: { logic: 'ALL' | 'ANY'; conditions: FinanceCondition[] },
  evidence: FinanceEvidence,
  now: Date,
) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const month = evidence.exceptions.filter((e) => e.date >= start && e.date <= end).map((e) => Math.max(e.difference, 0))
  const results = goal.conditions.map((c) => {
    const actual =
      c.measurement === 'chest_balance'
        ? chestBalance(c.chestId!, evidence.movements)
        : c.measurement === 'monthly_deviation_count'
          ? month.length
          : month.reduce((sum, a) => sum + a, 0)
    const target = c.targetValue
    const ok = { GTE: actual >= target, LTE: actual <= target, EQ: actual === target, GT: actual > target, LT: actual < target }[c.operator]
    return { actual, satisfied: ok }
  })
  return {
    satisfied: goal.logic === 'ALL' ? results.every((r) => r.satisfied) : results.some((r) => r.satisfied),
    results,
  }
}

// A small deterministic random generator, so a failure can be replayed.
function random(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
    return seed / 2 ** 31
  }
}

describe('the engine against the previous Finance evaluator', () => {
  it('gives the same results on generated data', () => {
    const rand = random(42)
    const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)]
    const chests = ['a', 'b', 'c']
    const operators = ['GTE', 'LTE', 'EQ', 'GT', 'LT'] as const
    const dayIn = (month: number) => new Date(2026, month, 1 + Math.floor(rand() * 28), Math.floor(rand() * 24))

    for (let run = 0; run < 300; run++) {
      const now = dayIn(9)
      const evidence: FinanceEvidence = {
        movements: Array.from({ length: Math.floor(rand() * 12) }, () => ({
          sourceChestId: rand() < 0.4 ? pick(chests) : null,
          destinationChestId: rand() < 0.7 ? pick(chests) : null,
          amount: Math.round(rand() * 5000),
          date: dayIn(8 + Math.floor(rand() * 3)),
        })),
        exceptions: Array.from({ length: Math.floor(rand() * 6) }, () => ({
          date: dayIn(8 + Math.floor(rand() * 3)),
          difference: Math.round(rand() * 4000) - 500,
        })),
      }
      const goal = {
        logic: pick(['ALL', 'ANY'] as const),
        conditions: Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, i) => {
          const measurement = pick(['chest_balance', 'monthly_deviation_count', 'monthly_deviation_amount'] as const)
          return condition(measurement, {
            id: `c${i}`,
            chestId: measurement === 'chest_balance' ? pick(chests) : null,
            operator: pick(operators),
            targetValue: measurement === 'monthly_deviation_count' ? Math.floor(rand() * 4) : Math.round(rand() * 6000),
          })
        }),
      }

      const engine = evaluateGroup(
        { id: 'root', logic: goal.logic, role: 'COMPLETION', conditions: goal.conditions.map((c) => ({ ...toEngineCondition(c), id: c.id })), children: [] },
        financeResolver(evidence, now),
        now,
        now,
      )
      const legacy = legacyEvaluate(goal, evidence, now)

      expect(engine.satisfied).toBe(legacy.satisfied)
      expect(engine.results.map((r) => [r.actual, r.satisfied])).toEqual(legacy.results.map((r) => [r.actual, r.satisfied]))
    }
  })
})

describe('the new Finance sources', () => {
  const now = new Date(2026, 9, 7, 12)
  const evidence: FinanceEvidence = {
    movements: [
      { sourceChestId: null, destinationChestId: 'savings', amount: 1000, date: new Date(2026, 9, 2), reason: 'DAILY_SAVING', type: 'IN' },
      { sourceChestId: null, destinationChestId: 'savings', amount: 5000, date: new Date(2026, 9, 1), reason: 'PLANNED_SAVING', type: 'IN' },
      { sourceChestId: null, destinationChestId: 'buffer', amount: 700, date: new Date(2026, 9, 3), reason: 'DAILY_SAVING', type: 'IN' },
      { sourceChestId: 'savings', destinationChestId: null, amount: 300, date: new Date(2026, 9, 4), reason: 'WITHDRAWAL', type: 'OUT' },
      { sourceChestId: 'buffer', destinationChestId: null, amount: 400, date: new Date(2026, 9, 31), reason: 'EXPENSE', type: 'OUT' },
      { sourceChestId: null, destinationChestId: 'debts', amount: 9000, date: new Date(2026, 9, 1), reason: 'DEBT', type: 'IN' },
    ],
    exceptions: [],
    expenses: [
      { date: new Date(2026, 9, 2), amount: 2000, category: 'food', paidFromChest: false },
      { date: new Date(2026, 9, 3), amount: 1500, category: 'transport', paidFromChest: false },
      { date: new Date(2026, 9, 3), amount: 8000, category: 'food', paidFromChest: true },
      { date: new Date(2026, 8, 30), amount: 999, category: 'food', paidFromChest: false },
    ],
    chests: [
      { id: 'savings', name: 'Monthly Savings', isSystem: true },
      { id: 'buffer', name: 'Buffer', isSystem: true },
      { id: 'debts', name: 'Debts Chest', isSystem: true },
    ],
    debtsOwed: [4000, 2500],
  }
  const measure = (measurement: FinanceCondition['measurement'], category: string | null = null) =>
    evaluateGroup(
      {
        id: 'root',
        logic: 'ALL',
        role: 'COMPLETION',
        conditions: [{ ...toEngineCondition({ ...condition(measurement), category }), id: 'c' }],
        children: [],
      },
      financeResolver(evidence, now),
      now,
      now,
    ).results[0].actual

  it('counts budget spending like the Today page, less what the reserves paid', () => {
    expect(measure('monthly_spending')).toBe(2000 + 1500 - 400)
    expect(budgetSpendingPoints(evidence, 'food').map((p) => p.value)).toEqual([2000, 999])
    expect(measure('monthly_category_spending', 'food')).toBe(2000)
  })

  it('adds the daily and planned savings of the month', () => {
    expect(savingsInPoints(evidence.movements)).toHaveLength(3)
    expect(measure('monthly_saved')).toBe(6700)
  })

  it('totals savings outside the Buffer and the Debts Chest', () => {
    expect(totalSavings(evidence)).toBe(5700)
    expect(measure('total_savings')).toBe(5700)
  })

  it('adds what is still owed on borrowed money', () => {
    expect(measure('debt_owed')).toBe(6500)
  })
})
