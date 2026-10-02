import { z } from 'zod'

import { getHistory } from '@/application/finance/getHistory'
import { settleDays } from '@/application/finance/settleDays'

import { endpoint, ok, periodField } from '../../api'
import { historyView } from '../../views'

const query = z.object({
  period: periodField.default('month'),
  type: z
    .enum(['all', 'expense', 'exception', 'movement'], {
      error: 'Use "all", "expense", "exception" or "movement" for the type.',
    })
    .default('all'),
  category: z.string().trim().max(40).optional(),
})

// GET /api/v1/finance/history?period=month&type=expense&category=food
export const GET = endpoint('READ', async (request, user) => {
  const { period, type, category } = query.parse(Object.fromEntries(new URL(request.url).searchParams))

  await settleDays(user)

  return ok(historyView(await getHistory({ userId: user.id, period, type, category: category || 'all' })))
})
