import { describe, expect, it } from 'vitest'

import { careerReminders } from './reminders'

// Sunday 11 October 2026.
const sunday = new Date(2026, 9, 11, 18)
const base = { today: sunday, opportunities: [], openFocus: 0, reviewDay: 7, dueForReview: 0 }

describe('Career reminders', () => {
  it('announce an opportunity deadline in 2 days and tomorrow, sooner first', () => {
    const reminders = careerReminders({
      ...base,
      opportunities: [
        { id: 'a', title: 'Beta offer', deadline: new Date(2026, 9, 13) },
        { id: 'b', title: 'Acme', deadline: new Date(2026, 9, 12) },
        { id: 'c', title: 'Later', deadline: new Date(2026, 9, 20) },
        { id: 'd', title: 'No date', deadline: null },
      ],
    })
    expect(reminders.map((r) => r.key)).toEqual(['career:deadline:b:1', 'career:deadline:a:2'])
  })

  it('ask for the weekly review on the review day, only with focus left open', () => {
    expect(careerReminders({ ...base, openFocus: 2 })).toMatchObject([{ kind: 'weeklyReview', key: 'career:review:2026-10-05', openFocus: 2 }])
    expect(careerReminders({ ...base, openFocus: 0 })).toEqual([])
    expect(careerReminders({ ...base, openFocus: 2, reviewDay: 5 })).toEqual([])
  })

  it('nudge about stale facts and judgements once a month', () => {
    expect(careerReminders({ ...base, dueForReview: 3 })).toMatchObject([{ kind: 'reviewDue', key: 'career:reviewDue:2026-10', count: 3 }])
  })
})
