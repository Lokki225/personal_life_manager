import { describe, expect, it } from 'vitest'

import { checkOpportunity, checkStatusChange, positionFromOffer, sortOpportunities, type OpportunityInput } from './opportunities'

const offer = (extra: Partial<OpportunityInput> = {}): OpportunityInput => ({
  title: ' Software Engineer ',
  organisation: 'Beta',
  kind: 'JOB',
  sourceUrl: 'https://jobs.example.com/1',
  notes: null,
  deadline: null,
  monthlyCompensation: 700000,
  workArrangement: 'hybrid',
  contractType: 'permanent',
  weeklyHours: 40,
  location: 'Abidjan',
  ...extra,
})

describe('opportunities', () => {
  it('are checked like a position, with a safe link', () => {
    expect(checkOpportunity(offer()).title).toBe('Software Engineer')
    expect(() => checkOpportunity(offer({ sourceUrl: 'javascript:alert(1)' }))).toThrow(expect.objectContaining({ field: 'url' }))
    expect(() => checkOpportunity(offer({ workArrangement: 'moon' }))).toThrow(expect.objectContaining({ field: 'workArrangement' }))
    expect(() => checkOpportunity(offer({ title: '' }))).toThrow(expect.objectContaining({ field: 'title' }))
  })

  it('say how they ended when closed, and only then', () => {
    expect(checkStatusChange('APPLIED', 'accepted')).toEqual({ status: 'APPLIED', outcome: null })
    expect(checkStatusChange('CLOSED', 'declined')).toEqual({ status: 'CLOSED', outcome: 'declined' })
    expect(() => checkStatusChange('CLOSED', null)).toThrow(expect.objectContaining({ field: 'outcome' }))
  })

  it('become a position from their terms when accepted', () => {
    const start = new Date(2026, 10, 1)
    expect(positionFromOffer(offer({ title: 'Engineer' }), start)).toMatchObject({
      kind: 'POSITION',
      title: 'Engineer',
      validFrom: start,
      organisation: 'Beta',
      monthlyCompensation: 700000,
      workArrangement: 'hybrid',
    })
  })

  it('list open ones by nearest deadline, closed ones last', () => {
    const at = (d: number) => new Date(2026, 9, d)
    const items = [
      { id: 'closed', status: 'CLOSED' as const, deadline: at(1), createdAt: at(1) },
      { id: 'later', status: 'APPLIED' as const, deadline: at(20), createdAt: at(1) },
      { id: 'none', status: 'FOUND' as const, deadline: null, createdAt: at(2) },
      { id: 'soon', status: 'OFFER' as const, deadline: at(9), createdAt: at(1) },
    ]
    expect(sortOpportunities(items).map((o) => o.id)).toEqual(['soon', 'later', 'none', 'closed'])
  })
})
