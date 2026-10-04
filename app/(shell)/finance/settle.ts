import { isSettled, settleDays } from '@/application/finance/settleDays'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now } from '@/lib/clock'

// Called at the top of the finance pages, after the clock is set. On the first page opened in a day
// it settles the days that ended (leftover to the Buffer, weekly Buffer to
// Base Chest); after that it costs nothing.
export async function ensureDaysSettled(): Promise<void> {
  const user = await getSignedInUser()

  if (user && !isSettled(user.settledThrough, now())) {
    await settleDays(user)
  }
}
