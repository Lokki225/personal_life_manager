import { describe, expect, it } from 'vitest'

import { signUpForm } from './schema'

const formDataOf = (entries: Record<string, string>) => {
  const formData = new FormData()
  Object.entries(entries).forEach(([key, value]) => formData.append(key, value))
  return formData
}

const valid = { firstName: 'Awa', lastName: 'Koné', email: 'awa@example.com', password: 'long-enough', confirmPassword: 'long-enough' }

const errorsOf = (entries: Record<string, string>) => {
  const result = signUpForm.parse(formDataOf(entries))
  return result.ok ? {} : result.state.fieldErrors
}

describe('sign-up form', () => {
  it('accepts an email and a matching password of 8 characters or more', () => {
    expect(signUpForm.parse(formDataOf(valid))).toEqual({ ok: true, data: valid })
  })

  it('reports each problem on its own field', () => {
    expect(errorsOf({ ...valid, email: 'not-an-email' })).toEqual({
      email: ['Enter a valid email, like you@example.com.'],
    })
    expect(errorsOf({ ...valid, email: '' }).email?.[0]).toBe('Enter your email.')
    expect(errorsOf({ ...valid, firstName: ' ', lastName: '' })).toEqual({
      firstName: ['Enter your first name.'],
      lastName: ['Enter your last name.'],
    })
    // The nickname is optional.
    expect(signUpForm.parse(formDataOf({ ...valid, username: 'Wawa' })).ok).toBe(true)
    expect(errorsOf({ ...valid, password: 'short', confirmPassword: 'short' })).toEqual({
      password: ['Use at least 8 characters.'],
    })
    expect(errorsOf({ ...valid, confirmPassword: 'something-else' })).toEqual({
      confirmPassword: ['The two passwords do not match.'],
    })
  })
})
