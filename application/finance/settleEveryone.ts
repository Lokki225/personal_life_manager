import { userRepository } from '../../infrastructure/repositories/userRepository'
import { withClockZone } from '../../lib/clock'
import { settleDays } from './settleDays'

// Closes the days that ended for everyone with a plan, on each person's own
// clock: the leftovers go to the Buffer and the weekly transfer happens even
// for someone who did not open the app. The evening reminders then tell what
// moved.
export async function settleEveryone(
  deps: { listPlanHolders: typeof userRepository.listPlanHolders; settle: typeof settleDays } = {
    listPlanHolders: userRepository.listPlanHolders,
    settle: settleDays,
  },
): Promise<number> {
  let settled = 0

  for (const person of await deps.listPlanHolders()) {
    // One person's trouble must not stop the others.
    try {
      await withClockZone(person.timeZone, () => deps.settle(person))
      settled += 1
    } catch (error) {
      console.error('Could not close the days of one person:', error)
    }
  }

  return settled
}
