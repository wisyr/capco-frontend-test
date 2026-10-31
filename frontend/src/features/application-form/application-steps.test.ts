import { describe, expect, it } from 'vitest'

import {
  answersForStep,
  fieldLabel,
  stepFields,
  valuesFromAnswers,
} from './application-steps'

describe('valuesFromAnswers', () => {
  it('fills saved answers and leaves missing or null answers empty', () => {
    const values = valuesFromAnswers({
      name: 'Ada Lovelace',
      phone: null,
      city: 'London',
      consentConfirmed: true,
    })

    expect(values.consentConfirmed).toBe(true)
    expect(values.text).toMatchObject({
      name: 'Ada Lovelace',
      phone: '',
      city: 'London',
      dateOfBirth: '',
    })
    expect(Object.keys(values.text)).toHaveLength(14)
  })

  it('treats missing consent as not given', () => {
    expect(valuesFromAnswers({}).consentConfirmed).toBe(false)
  })
})

describe('answersForStep', () => {
  const values = valuesFromAnswers({
    name: 'Ada Lovelace',
    city: 'London',
    consentConfirmed: true,
  })

  it('sends only personal details, including consent and cleared fields', () => {
    expect(answersForStep('personal-details', values)).toEqual({
      name: 'Ada Lovelace',
      dateOfBirth: '',
      country: '',
      nationality: '',
      email: '',
      phone: '',
      consentConfirmed: true,
    })
  })

  it('sends only identity and address fields', () => {
    const answers = answersForStep('identity-and-address', values)

    expect(Object.keys(answers)).toEqual(
      stepFields['identity-and-address'].map(({ name }) => name),
    )
    expect(answers.city).toBe('London')
    expect(answers).not.toHaveProperty('consentConfirmed')
  })
})

describe('fieldLabel', () => {
  it('names text, consent and document fields as the form labels them', () => {
    expect(fieldLabel('personal-details', 'dateOfBirth')).toBe('Date of birth')
    expect(fieldLabel('personal-details', 'consentConfirmed')).toBe(
      'Confirmation that these details are yours',
    )
    expect(fieldLabel('identity-and-address', 'documentEvidence')).toBe(
      'Document evidence',
    )
  })

  it('falls back to the API name for a field it does not know', () => {
    expect(fieldLabel('identity-and-address', 'taxNumber')).toBe('taxNumber')
  })
})
