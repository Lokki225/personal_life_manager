import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}))

vi.mock('@/infrastructure/prisma/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1' }),
    },
  },
}))

vi.mock('@/application/finance/recordSaving', () => ({
  recordSaving: vi.fn().mockResolvedValue({ id: 'saving-1' }),
}))

vi.mock('@/application/finance/createBudgetException', () => ({
  createBudgetException: vi.fn().mockResolvedValue({ id: 'exception-1' }),
}))

import { getServerSession } from 'next-auth'
import { createBudgetException } from '@/application/finance/createBudgetException'
import { recordSaving } from '@/application/finance/recordSaving'

import { recordException, saveUnderspend, transferBufferToSavings } from './actions'

describe('saveUnderspend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'user@example.com' },
    } as never)
  })

  it('stores the remaining amount in the weekly buffer', async () => {
    const formData = new FormData()
    formData.set('amount', '500')

    await saveUnderspend(formData)

    expect(recordSaving).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 500,
        source: 'underspending',
        destination: 'buffer',
      }),
    )
  })
})

describe('recordException', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'user@example.com' },
    } as never)
  })

  it('stores the overspend with category and reason metadata', async () => {
    const formData = new FormData()
    formData.set('plannedAmount', '500')
    formData.set('actualAmount', '640')
    formData.set('category', 'food')
    formData.set('reason', 'Unexpected dinner')
    formData.set('resolution', 'Trim spending this week')

    await recordException(formData)

    expect(createBudgetException).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        plannedAmount: 500,
        actualAmount: 640,
        category: 'food',
        reason: 'Unexpected dinner',
        resolution: 'Trim spending this week',
      }),
    )
  })
})

describe('transferBufferToSavings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'user@example.com' },
    } as never)
  })

  it('moves the buffer amount into actual savings', async () => {
    const formData = new FormData()
    formData.set('amount', '300')

    await transferBufferToSavings(formData)

    expect(recordSaving).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 300,
        source: 'buffer_transfer',
        destination: 'savings',
      }),
    )
  })
})
