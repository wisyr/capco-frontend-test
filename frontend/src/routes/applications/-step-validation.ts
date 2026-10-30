import { emailAddressPattern } from '../-email-address'

import {
  stepFields,
  type AnswerValues,
  type TextAnswerField,
} from './-application-steps'
import { documentFileError } from './-document-evidence'

import type { ApplicationStep } from '../../api/applicant-applications'

/** Fields that can show an error: every text answer, consent and document. */
export type StepField = TextAnswerField | 'consentConfirmed' | 'document'
export type StepErrors = Partial<Record<StepField, string>>

/**
 * `complete` is for moving on, so every answer is required. `partial` is for
 * saving a draft: blanks are fine, but anything filled in must be valid.
 */
export type StepCompleteness = 'complete' | 'partial'

export interface StepDocument {
  /** Whether the API already stores a document for this application. */
  present: boolean
  /** A newly chosen image that has not been uploaded yet. */
  file: File | null
}

type FormatCheck = (value: string, today: string) => string | undefined

const formatChecks: Partial<Record<TextAnswerField, FormatCheck>> = {
  email: (value) =>
    emailAddressPattern.test(value)
      ? undefined
      : 'Enter an email address in the format name@example.com.',
  dateOfBirth: (value, today) => {
    if (!isIsoDate(value)) {
      return 'Enter your date of birth as year-month-day, for example 1990-04-23.'
    }
    return value < today ? undefined : 'Date of birth must be in the past.'
  },
  expiry: (value, today) => {
    if (!isIsoDate(value)) {
      return 'Enter the expiry date as year-month-day, for example 2031-08-31.'
    }
    return value >= today
      ? undefined
      : 'This document has expired. Use a document that is still valid.'
  },
}

/** Checks one step's answers before saving or moving on. */
export function validateStep(
  step: ApplicationStep,
  values: AnswerValues,
  document: StepDocument,
  completeness: StepCompleteness,
  today = new Date(),
): StepErrors {
  const todayIso = localIsoDate(today)
  const errors: StepErrors = {}
  for (const { name, requiredMessage } of stepFields[step]) {
    const value = values.text[name].trim()
    if (value) {
      errors[name] = formatChecks[name]?.(value, todayIso)
    } else if (completeness === 'complete') {
      errors[name] = requiredMessage
    }
  }
  if (step === 'personal-details') {
    if (completeness === 'complete' && !values.consentConfirmed) {
      errors.consentConfirmed =
        'Confirm that these details are accurate and belong to you.'
    }
  } else if (document.file) {
    errors.document = documentFileError(document.file)
  } else if (completeness === 'complete' && !document.present) {
    errors.document = 'Choose an image of your identity document.'
  }
  return errors
}

export function hasStepErrors(errors: StepErrors): boolean {
  return Object.values(errors).some(Boolean)
}

/** A real calendar date written as YYYY-MM-DD, such as 1990-04-23. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  // Rejects dates that do not exist, such as 2023-02-30.
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Today in the applicant's own time zone, as YYYY-MM-DD. */
function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
