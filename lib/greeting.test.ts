import { describe, expect, it } from 'vitest'

import { displayNameFromEmail, fullName, greetingFor, shortName } from './greeting'

describe('names', () => {
  const email = 'awa.kone@example.com'

  it('greets with the nickname, then the first name, then a guess from the email', () => {
    expect(shortName({ email, firstName: 'Awa', lastName: 'Koné', username: 'Wawa' })).toBe('Wawa')
    expect(shortName({ email, firstName: 'Awa', lastName: 'Koné', username: ' ' })).toBe('Awa')
    expect(shortName({ email })).toBe('Awa')
  })

  it('lists people under their first and last name when known', () => {
    expect(fullName({ email, firstName: 'Awa', lastName: 'Koné', username: 'Wawa' })).toBe('Awa Koné')
    expect(fullName({ email, firstName: 'Awa' })).toBe('Awa')
    expect(fullName({ email, username: 'Wawa' })).toBe('Wawa')
    expect(fullName({ email: '2001@example.com' })).toBe('2001@example.com')
  })
})

describe('greetingFor', () => {
  it('follows the time of day', () => {
    expect(greetingFor(new Date(2026, 9, 10, 3)).salutation).toBe('Still up')
    expect(greetingFor(new Date(2026, 9, 10, 8)).salutation).toBe('Good morning')
    expect(greetingFor(new Date(2026, 9, 10, 14)).salutation).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 9, 10, 20)).salutation).toBe('Good evening')
  })

  it('marks the first and last days of a month', () => {
    expect(greetingFor(new Date(2026, 9, 1, 8)).note).toBe('October starts here. A fresh budget.')
    expect(greetingFor(new Date(2026, 9, 30, 8)).note).toBe('Last days of October. Finish it well.')
    expect(greetingFor(new Date(2026, 1, 26, 8)).note).toBe('Last days of February. Finish it well.')
  })

  it('has its own line for each month in between', () => {
    const notes = Array.from({ length: 12 }, (_, month) => greetingFor(new Date(2026, month, 15, 8)).note)

    expect(new Set(notes).size).toBe(12)
    expect(notes[9]).toBe('Last quarter of the year begins.')
  })
})

describe('displayNameFromEmail', () => {
  it('takes a first name from the start of the address', () => {
    expect(displayNameFromEmail('franklin.lokki@gmail.com')).toBe('Franklin')
    expect(displayNameFromEmail('FRANKLINLOKKI@gmail.com')).toBe('Franklinlokki')
    expect(displayNameFromEmail('amina_2001@example.com')).toBe('Amina')
  })

  it('gives nothing when there is no usable name', () => {
    expect(displayNameFromEmail('')).toBeNull()
    expect(displayNameFromEmail(null)).toBeNull()
    expect(displayNameFromEmail('2001@example.com')).toBeNull()
  })
})
