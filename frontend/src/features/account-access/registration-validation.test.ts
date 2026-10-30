import { describe, expect, it } from 'vitest'

import {
  validateRegistration,
  type RegistrationValues,
} from './registration-validation'

const valid: RegistrationValues = {
  email: '  ada@example.com ',
  password: 'Secret!',
  passwordConfirmation: 'Secret!',
}

describe('validateRegistration', () => {
  it('returns trimmed credentials for valid input', () => {
    expect(validateRegistration(valid)).toEqual({
      success: true,
      credentials: { email: 'ada@example.com', password: 'Secret!' },
    })
  })

  it('asks for every missing field', () => {
    expect(
      validateRegistration({
        email: ' ',
        password: '',
        passwordConfirmation: '',
      }),
    ).toEqual({
      success: false,
      errors: {
        email: 'Enter your email address.',
        password: 'Enter a password.',
        passwordConfirmation: 'Confirm your password.',
      },
    })
  })

  it.each([
    'ada@',
    'ada@localhost',
    'ada lovelace@example.com',
    '@example.com',
  ])('rejects the email address %s', (email) => {
    expect(validateRegistration({ ...valid, email })).toMatchObject({
      errors: {
        email: 'Enter an email address in the format name@example.com.',
      },
    })
  })

  it.each([
    'user@bücher.de',
    'jöhn@example.com',
    'a@b.c',
    "o'brien@example.ie",
  ])('accepts the email address %s, as the API does', (email) => {
    expect(validateRegistration({ ...valid, email }).success).toBe(true)
  })

  it.each([
    ['Ab!', 'Password must be at least 6 characters.'],
    ['secret!', 'Password must include an uppercase letter.'],
    ['Secret1', 'Password must include a special character, such as ! or #.'],
  ])('rejects the password %s', (password, message) => {
    expect(
      validateRegistration({
        ...valid,
        password,
        passwordConfirmation: password,
      }),
    ).toMatchObject({ errors: { password: message } })
  })

  it('accepts non-ASCII uppercase letters and symbols', () => {
    expect(
      validateRegistration({
        ...valid,
        password: 'Łódź€€',
        passwordConfirmation: 'Łódź€€',
      }),
    ).toMatchObject({ success: true })
  })

  it('reports mismatched passwords even when the email is invalid', () => {
    expect(
      validateRegistration({
        email: 'not-an-email',
        password: 'Secret!',
        passwordConfirmation: 'Secret?',
      }),
    ).toMatchObject({
      errors: { passwordConfirmation: 'Passwords do not match.' },
    })
  })
})
