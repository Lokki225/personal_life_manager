// What happens on its own when a day ends: the money left of the day goes to
// the Buffer, and once a week the Buffer is emptied into the Base Chest.

export type SettlementAction = {
  kind: 'leftover' | 'sweep'
  // When it counts: the end of the day for a leftover, the first moment of
  // the sweep day for a sweep.
  at: Date
  amount: number
}

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// The days from `firstDay` to `lastDay`, both included, in order: each one
// gives its leftover to the Buffer, and each time a day equal to `sweepDay`
// (0 is Sunday) begins, everything in the Buffer goes to the Base Chest.
export function settlementActions({
  firstDay,
  lastDay,
  sweepDay,
  bufferBalance,
  leftoverOf,
}: {
  firstDay: Date
  lastDay: Date
  sweepDay: number
  bufferBalance: number
  leftoverOf: (day: Date) => number
}): SettlementAction[] {
  const actions: SettlementAction[] = []
  let balance = bufferBalance

  for (let day = dayStart(firstDay); day <= lastDay; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    // Whole units only: XOF has no minor unit.
    const leftover = Math.floor(leftoverOf(day))

    if (leftover >= 1) {
      actions.push({
        kind: 'leftover',
        at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59),
        amount: leftover,
      })
      balance += leftover
    }

    const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)

    if (nextDay.getDay() === sweepDay && Math.floor(balance) >= 1) {
      actions.push({ kind: 'sweep', at: nextDay, amount: Math.floor(balance) })
      balance -= Math.floor(balance)
    }
  }

  return actions
}
