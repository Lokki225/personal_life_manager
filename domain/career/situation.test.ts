import { describe, expect, it } from 'vitest'

import { checkFact, checkLocations, checkUrl, isCurrent, isReviewDue, primaryPosition, sourceWithEvidence, type FactInput } from './situation'

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const today = day(2026, 10, 7)

const position = (id: string, validFrom: Date, extra: object = {}) => ({
  id,
  kind: 'POSITION' as const,
  validFrom,
  validTo: null as Date | null,
  isPrimary: false,
  ...extra,
})

describe('current facts', () => {
  it('are true from their start, until the day they ended', () => {
    expect(isCurrent({ validFrom: day(2024, 1, 1), validTo: null }, today)).toBe(true)
    expect(isCurrent({ validFrom: day(2026, 10, 8), validTo: null }, today)).toBe(false)
    expect(isCurrent({ validFrom: day(2024, 1, 1), validTo: today }, today)).toBe(false)
    expect(isCurrent({ validFrom: day(2024, 1, 1), validTo: day(2026, 10, 8) }, today)).toBe(true)
  })
})

describe('primaryPosition', () => {
  it('is the only current position, or none', () => {
    expect(primaryPosition([], today)).toBeNull()
    expect(primaryPosition([position('a', day(2025, 1, 1), { validTo: day(2026, 1, 1) })], today)).toBeNull()
    expect(primaryPosition([position('a', day(2025, 1, 1))], today)).toMatchObject({ fact: { id: 'a' }, chosen: 'only' })
  })

  it('is the one marked, else the one started last, and says how it was chosen', () => {
    const facts = [position('old', day(2023, 1, 1)), position('new', day(2025, 6, 1))]
    expect(primaryPosition(facts, today)).toMatchObject({ fact: { id: 'new' }, chosen: 'latest' })
    expect(primaryPosition([{ ...facts[0], isPrimary: true }, facts[1]], today)).toMatchObject({ fact: { id: 'old' }, chosen: 'marked' })
  })
})

describe('fact source and review', () => {
  it('is documented while evidence is linked, unless the person confirmed it', () => {
    expect(sourceWithEvidence('SELF', 1)).toBe('DOCUMENTED')
    expect(sourceWithEvidence('DOCUMENTED', 0)).toBe('SELF')
    expect(sourceWithEvidence('CONFIRMED', 0)).toBe('CONFIRMED')
  })

  it('is due for review after 180 days without a look', () => {
    expect(isReviewDue({ lastReviewedAt: null, createdAt: day(2026, 1, 1) }, today)).toBe(true)
    expect(isReviewDue({ lastReviewedAt: day(2026, 9, 1), createdAt: day(2020, 1, 1) }, today)).toBe(false)
  })
})

describe('checkFact', () => {
  const input = (extra: Partial<FactInput> = {}): FactInput => ({
    kind: 'POSITION',
    title: ' RPA Developer ',
    details: null,
    validFrom: day(2024, 1, 1),
    validTo: null,
    organisation: 'Acme',
    monthlyCompensation: 450000,
    workArrangement: 'on_site',
    contractType: 'permanent',
    weeklyHours: 40,
    location: 'Abidjan',
    issuer: 'nobody',
    obtainedAt: null,
    expiresAt: null,
    level: 'expert',
    positionId: null,
    ...extra,
  })

  it('keeps only what the kind uses', () => {
    expect(checkFact(input())).toMatchObject({ title: 'RPA Developer', monthlyCompensation: 450000, issuer: null, level: null })
    expect(checkFact(input({ kind: 'SKILL' }))).toMatchObject({ level: 'expert', monthlyCompensation: null, organisation: null })
  })

  it('points at what is wrong', () => {
    expect(() => checkFact(input({ title: ' ' }))).toThrow(expect.objectContaining({ field: 'title' }))
    expect(() => checkFact(input({ validTo: day(2023, 1, 1) }))).toThrow(expect.objectContaining({ field: 'validTo' }))
    expect(() => checkFact(input({ monthlyCompensation: -1 }))).toThrow(expect.objectContaining({ field: 'monthlyCompensation' }))
    expect(() => checkFact(input({ weeklyHours: 200 }))).toThrow(expect.objectContaining({ field: 'weeklyHours' }))
    expect(() => checkFact(input({ workArrangement: 'moon' }))).toThrow(expect.objectContaining({ field: 'workArrangement' }))
    expect(() => checkFact(input({ kind: 'QUALIFICATION', obtainedAt: day(2025, 1, 1), expiresAt: day(2024, 1, 1) }))).toThrow(
      expect.objectContaining({ field: 'expiresAt' }),
    )
  })
})

describe('checkUrl', () => {
  it('keeps web links and refuses anything that could run in the app', () => {
    expect(checkUrl('https://github.com/me/repo')).toBe('https://github.com/me/repo')
    expect(checkUrl('  ')).toBeNull()
    expect(() => checkUrl('javascript:alert(1)')).toThrow(expect.objectContaining({ field: 'url' }))
    expect(() => checkUrl('data:text/html,<script>x</script>')).toThrow()
    expect(() => checkUrl('github.com/me')).toThrow()
  })
})

describe('checkLocations', () => {
  it('trims and removes repeats, whatever the case', () => {
    expect(checkLocations([' Abidjan', 'abidjan', '', 'Remote Europe'])).toEqual(['Abidjan', 'Remote Europe'])
  })
})
