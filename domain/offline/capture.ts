// Rules for actions captured offline and sent later (Ressources/offline-mode-codebase-plan.md, step 5).

const DAY_MS = 86_400_000

// When an action may say it happened: not more than a day ahead (clocks
// drift) and not more than 31 days back. Null when it is acceptable.
export function occurredAtProblem(occurredAt: Date, now: Date): string | null {
  if (Number.isNaN(occurredAt.getTime())) return 'This action has no valid date.'
  if (occurredAt.getTime() - now.getTime() > DAY_MS) return 'This action is dated in the future.'
  if (now.getTime() - occurredAt.getTime() > 31 * DAY_MS) return 'This action is more than a month old.'
  return null
}

// An expense that arrives for a day already closed. That day's leftover was
// moved to the Buffer without it, so part of it was not really left: the
// expense takes back from that leftover what is still uncorrected, and what
// goes beyond is that day's overspend (decision 2 of the plan).
export function lateExpenseSplit(input: { amount: number; leftover: number; alreadyTakenBack: number }): { takeBack: number; over: number } {
  const available = Math.max(input.leftover - input.alreadyTakenBack, 0)
  const takeBack = Math.min(input.amount, available)
  return { takeBack, over: input.amount - takeBack }
}

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
