import type { Answers, ApplicationStep } from '../../api/applicant-applications'

/** Answer fields entered as text; consent is the only non-text answer. */
export type TextAnswerField = Exclude<keyof Answers, 'consentConfirmed'>

export interface TextFieldDefinition {
  name: TextAnswerField
  label: string
  /** WCAG 1.3.5: lets browsers and assistive tech identify the purpose. */
  autoComplete?: string
  type?: 'email' | 'tel'
  /** WCAG 3.3.2: states the expected format where one is needed. */
  hint?: string
  /** Shown beside the field when it is left empty on Continue. */
  requiredMessage: string
}

export const stepFields: Record<
  ApplicationStep,
  readonly TextFieldDefinition[]
> = {
  'personal-details': [
    {
      name: 'name',
      label: 'Name',
      autoComplete: 'name',
      requiredMessage: 'Enter your name.',
    },
    {
      name: 'dateOfBirth',
      label: 'Date of birth',
      autoComplete: 'bday',
      hint: 'Use year-month-day, for example 1990-04-23.',
      requiredMessage: 'Enter your date of birth.',
    },
    {
      name: 'country',
      label: 'Country',
      autoComplete: 'country-name',
      requiredMessage: 'Enter your country.',
    },
    {
      name: 'nationality',
      label: 'Nationality',
      requiredMessage: 'Enter your nationality.',
    },
    {
      name: 'email',
      label: 'Email',
      autoComplete: 'email',
      type: 'email',
      requiredMessage: 'Enter your email address.',
    },
    {
      name: 'phone',
      label: 'Phone',
      autoComplete: 'tel',
      type: 'tel',
      requiredMessage: 'Enter your phone number.',
    },
  ],
  'identity-and-address': [
    {
      name: 'documentType',
      label: 'Document type',
      requiredMessage: 'Enter the document type, for example Passport.',
    },
    {
      name: 'documentNumber',
      label: 'Document number',
      requiredMessage: 'Enter the document number.',
    },
    {
      name: 'documentCountry',
      label: 'Document country',
      requiredMessage: 'Enter the country that issued the document.',
    },
    {
      name: 'expiry',
      label: 'Expiry',
      hint: 'Use year-month-day, for example 2031-08-31.',
      requiredMessage: 'Enter the expiry date.',
    },
    {
      name: 'street',
      label: 'Street',
      autoComplete: 'street-address',
      requiredMessage: 'Enter your street address.',
    },
    {
      name: 'city',
      label: 'City',
      autoComplete: 'address-level2',
      requiredMessage: 'Enter your city.',
    },
    {
      name: 'postal',
      label: 'Postal code',
      autoComplete: 'postal-code',
      requiredMessage: 'Enter your postal code.',
    },
    {
      name: 'residentialCountry',
      label: 'Residential country',
      autoComplete: 'country-name',
      requiredMessage: 'Enter your country of residence.',
    },
  ],
}

export const stepTitles: Record<ApplicationStep, string> = {
  'personal-details': 'Personal details',
  'identity-and-address': 'Identity and address',
}

/** Editable form state for every answer, with unanswered fields empty. */
export interface AnswerValues {
  text: Record<TextAnswerField, string>
  consentConfirmed: boolean
}

const textFieldNames = Object.values(stepFields).flatMap((fields) =>
  fields.map(({ name }) => name),
)

/** Fills the form from saved answers; null or missing answers become empty. */
export function valuesFromAnswers(answers: Answers): AnswerValues {
  const text = Object.fromEntries(
    textFieldNames.map((name) => [name, answers[name] ?? '']),
  ) as Record<TextAnswerField, string>
  return { text, consentConfirmed: answers.consentConfirmed ?? false }
}

/**
 * The answers to save for one step. The API accepts only that step's fields,
 * and an empty string clears a previously saved answer.
 */
export function answersForStep(
  step: ApplicationStep,
  values: AnswerValues,
): Answers {
  const answers: Answers = Object.fromEntries(
    stepFields[step].map(({ name }) => [name, values.text[name]]),
  )
  if (step === 'personal-details') {
    answers.consentConfirmed = values.consentConfirmed
  }
  return answers
}
