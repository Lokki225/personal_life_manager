import { isSettled, settleDays } from '@/application/finance/settleDays'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

// Called at the top of the finance pages. On the first page opened in a day
// it settles the days that ended (leftover to the Buffer, weekly Buffer to
// Base Chest); after that it costs nothing.
export async function ensureDaysSettled(): Promise<void> {
  const user = await getSignedInUser()

  if (user && !isSettled(user.settledThrough, new Date())) {
    await settleDays(user)
  }
}
