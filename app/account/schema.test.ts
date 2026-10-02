import { describe, expect, it } from 'vitest'

import { credentialsForm, profileForm } from './schema'

const formDataOf = (entries: Record<string, string>) => {
  const formData = new FormData()
  Object.entries(entries).forEach(([key, value]) => formData.append(key, value))
  return formData
}

const errorsOf = (form: typeof profileForm | typeof credentialsForm, entries: Record<string, string>) => {
  const result = form.parse(formDataOf(entries))
  return result.ok ? {} : result.state.fieldErrors
}

describe('profile form', () => {
  const names = { firstName: 'Awa', lastName: 'Koné' }

  it('only requires the two names', () => {
    expect(profileForm.parse(formDataOf(names)).ok).toBe(true)
    expect(profileForm.parse(formDataOf({ ...names, phone: '', birthDate: '', username: '' })).ok).toBe(true)
    expect(errorsOf(profileForm, { firstName: ' ', lastName: '' })).toEqual({
      firstName: ['Enter your first name.'],
      lastName: ['Enter your last name.'],
    })
  })

  it('checks the phone number, the date and the length of the bio', () => {
    expect(profileForm.parse(formDataOf({ ...names, phone: '+225 07 00 00 00 00', birthDate: '1998-05-12' })).ok).toBe(true)
    expect(errorsOf(profileForm, { ...names, phone: 'call me' }).phone).toBeDefined()
    expect(errorsOf(profileForm, { ...names, birthDate: '12/05/1998' }).birthDate).toEqual(['Choose a valid date.'])
    expect(errorsOf(profileForm, { ...names, bio: 'x'.repeat(161) }).bio).toEqual(['Keep it under 160 characters.'])
  })
})

describe('credentials form', () => {
  const valid = { email: 'awa@example.com', currentPassword: 'old-secret' }

  it('lets the new password stay empty, to change only the email', () => {
    expect(credentialsForm.parse(formDataOf({ ...valid, newPassword: '', confirmPassword: '' })).ok).toBe(true)
    expect(credentialsForm.parse(formDataOf(valid)).ok).toBe(true)
  })

  it('asks for the current password, a long enough new one, and a matching confirmation', () => {
    expect(errorsOf(credentialsForm, { ...valid, currentPassword: '' }).currentPassword).toEqual([
      'Enter your current password.',
    ])
    expect(errorsOf(credentialsForm, { ...valid, newPassword: 'short', confirmPassword: 'short' }).newPassword).toBeDefined()
    expect(errorsOf(credentialsForm, { ...valid, newPassword: 'new-secret', confirmPassword: 'other' })).toEqual({
      confirmPassword: ['The two passwords do not match.'],
    })
  })
})
