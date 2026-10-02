import { z } from 'zod'

import { getReview } from '@/application/finance/getReview'
import { settleDays } from '@/application/finance/settleDays'

import { endpoint, ok, periodField } from '../../api'
import { reviewView } from '../../views'

const query = z.object({ period: periodField.default('month') })

// GET /api/v1/finance/review?period=week
export const GET = endpoint('READ', async (request, user) => {
  const { period } = query.parse(Object.fromEntries(new URL(request.url).searchParams))

  await settleDays(user)

  return ok(reviewView(await getReview({ userId: user.id, period })))
})
