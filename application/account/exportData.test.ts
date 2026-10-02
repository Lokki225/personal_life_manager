import { describe, expect, it, vi } from 'vitest'

import { exportUserData } from './exportData'

describe('exportUserData', () => {
  it('gathers what one person recorded, without any secret', async () => {
    const list = (rows: unknown[]) => vi.fn().mockResolvedValue(rows)
    const deps = {
      getProfile: vi.fn().mockResolvedValue({ email: 'awa@example.com', firstName: 'Awa' }),
      finance: {
        listIncomes: list([{ id: 'income-1' }]),
        listAllocations: list([]),
        listExpenses: list([{ id: 'expense-1', amount: 500 }]),
        listBudgetExceptions: list([]),
        listChests: list([{ id: 'chest-1', name: 'Vault', passwordHash: 'secret-hash' }]),
        listMovements: list([]),
        listGoals: list([]),
        listDebts: list([]),
        listProjects: list([]),
      },
    }

    const data = await exportUserData('user-1', deps as never, new Date('2026-10-03T12:00:00Z'))

    expect(deps.finance.listExpenses).toHaveBeenCalledWith('user-1')
    expect(data.exportedAt).toBe('2026-10-03T12:00:00.000Z')
    expect(data.profile).toEqual({ email: 'awa@example.com', firstName: 'Awa' })
    expect(data.finance.expenses).toEqual([{ id: 'expense-1', amount: 500 }])
    expect(data.finance.chests).toEqual([{ id: 'chest-1', name: 'Vault' }])
    expect(JSON.stringify(data)).not.toContain('secret-hash')
  })
})
