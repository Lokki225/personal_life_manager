import { z } from 'zod'

import { saveDailyRemaining } from '@/application/finance/saveDailyRemaining'

import { amountField, endpoint, ok, readBody } from '../../api'
import { todayView } from '../../views'
import { financeState } from '../state'

const saving = z.object(
  {
    amount: amountField,
    // The chest to put it in. The Buffer when left out.
    chestId: z.string().trim().min(1).optional(),
  },
  { error: 'Send the saving as a JSON object.' },
)

// Puts part of what is left of the budget of today into a chest.
export const POST = endpoint('WRITE', async (request, user) => {
  const { amount, chestId } = await readBody(request, saving)

  await financeState(user)
  await saveDailyRemaining({ userId: user.id, amount, destinationChestId: chestId ?? null })

  const { state, pendingIncomes, today } = await financeState(user)

  return ok(todayView(state, pendingIncomes, today), 201)
})
