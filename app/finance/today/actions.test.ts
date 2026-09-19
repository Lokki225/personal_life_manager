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

import { getServerSession } from 'next-auth'
import { recordSaving } from '@/application/finance/recordSaving'

import { saveUnderspend } from './actions'

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
