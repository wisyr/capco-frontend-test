import { describe, expect, it } from 'vitest'

import { valuesFromAnswers } from './application-steps'
import { hasStepErrors, validateStep } from './step-validation'

const today = new Date(2026, 9, 30)
const noDocument = { present: false, file: null }
const storedDocument = { present: true, file: null }

const personalDetails = {
  name: 'Ada Lovelace',
  dateOfBirth: '1815-12-10',
  country: 'United Kingdom',
  nationality: 'British',
  email: 'ada@example.com',
  phone: '+44 20 7946 0000',
  consentConfirmed: true,
}
const identityAndAddress = {
  documentType: 'Passport',
  documentNumber: '123456789',
  documentCountry: 'United Kingdom',
  expiry: '2031-08-31',
  street: '12 St James Square',
  city: 'London',
  postal: 'SW1Y 4JH',
  residentialCountry: 'United Kingdom',
}

function check(
  answers: object,
  completeness: 'complete' | 'partial',
  step: 'personal-details' | 'identity-and-address' = 'personal-details',
  document: { present: boolean; file: File | null } = noDocument,
) {
  return validateStep(
    step,
    valuesFromAnswers(answers),
    document,
    completeness,
    today,
  )
}

describe('validateStep', () => {
  it('accepts a complete, valid step', () => {
    expect(hasStepErrors(check(personalDetails, 'complete'))).toBe(false)
    expect(
      hasStepErrors(
        check(
          identityAndAddress,
          'complete',
          'identity-and-address',
          storedDocument,
        ),
      ),
    ).toBe(false)
  })

  it('requires every answer, consent and the document to continue', () => {
    expect(check({}, 'complete')).toEqual({
      name: 'Enter your name.',
      dateOfBirth: 'Enter your date of birth.',
      country: 'Enter your country.',
      nationality: 'Enter your nationality.',
      email: 'Enter your email address.',
      phone: 'Enter your phone number.',
      consentConfirmed:
        'Confirm that these details are accurate and belong to you.',
    })
    expect(
      check(identityAndAddress, 'complete', 'identity-and-address'),
    ).toEqual({ document: 'Choose an image of your identity document.' })
  })

  it('treats an answer of only spaces as empty', () => {
    expect(check({ ...personalDetails, name: '   ' }, 'complete').name).toBe(
      'Enter your name.',
    )
  })

  it('lets a draft be saved with blanks', () => {
    expect(hasStepErrors(check({ name: 'Ada' }, 'partial'))).toBe(false)
    expect(hasStepErrors(check({}, 'partial', 'identity-and-address'))).toBe(
      false,
    )
  })

  it.each(['complete', 'partial'] as const)(
    'checks the format of filled-in answers (%s)',
    (completeness) => {
      const errors = check(
        { ...personalDetails, email: 'ada@example', dateOfBirth: '10/12/1815' },
        completeness,
      )

      expect(errors.email).toBe(
        'Enter an email address in the format name@example.com.',
      )
      expect(errors.dateOfBirth).toBe(
        'Enter your date of birth as year-month-day, for example 1990-04-23.',
      )
    },
  )

  it.each([
    ['a date that does not exist', '2023-02-30'],
    ['today', '2026-10-30'],
    ['a future date', '2030-01-01'],
  ])('rejects %s as a date of birth', (_, dateOfBirth) => {
    expect(
      check({ ...personalDetails, dateOfBirth }, 'partial').dateOfBirth,
    ).toBeDefined()
  })

  it('accepts a document that expires today but not one that has expired', () => {
    const expiring = (expiry: string) =>
      check(
        { ...identityAndAddress, expiry },
        'partial',
        'identity-and-address',
      ).expiry

    expect(expiring('2026-10-30')).toBeUndefined()
    expect(expiring('2026-10-29')).toBe(
      'This document has expired. Use a document that is still valid.',
    )
  })

  it('checks a newly chosen document even in a draft', () => {
    const pdf = new File(['%PDF'], 'id.pdf', { type: 'application/pdf' })

    expect(
      check({}, 'partial', 'identity-and-address', { present: true, file: pdf })
        .document,
    ).toBe('Choose a JPG or PNG image.')
  })
})
