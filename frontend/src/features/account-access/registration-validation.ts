import { z } from 'zod'

import { emailAddressPattern } from '../../shared/email-address'

export interface RegistrationValues {
  email: string
  password: string
  passwordConfirmation: string
}

export type RegistrationField = keyof RegistrationValues

export type RegistrationErrors = Partial<Record<RegistrationField, string>>

/** Password policy from POST /api/v1/applicant-accounts in the API contract. */
export const passwordPolicy =
  'Use at least 6 characters, including an uppercase letter and a special character.'

const passwordSchema = z
  .string()
  .min(1, 'Enter a password.')
  .min(6, 'Password must be at least 6 characters.')
  .regex(/\p{Lu}/u, 'Password must include an uppercase letter.')
  .regex(
    /[^\p{L}\p{N}]/u,
    'Password must include a special character, such as ! or #.',
  )

const registrationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Enter your email address.')
      .regex(
        emailAddressPattern,
        'Enter an email address in the format name@example.com.',
      ),
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Confirm your password.'),
  })
  .refine(
    ({ password, passwordConfirmation }) => password === passwordConfirmation,
    {
      path: ['passwordConfirmation'],
      message: 'Passwords do not match.',
      // Compare once both passwords are usable, even if the email is invalid.
      when: ({ value }) => {
        const { password, passwordConfirmation } = value as RegistrationValues
        return (
          passwordSchema.safeParse(password).success &&
          passwordConfirmation.length > 0
        )
      },
    },
  )

export type RegistrationValidationResult =
  | { success: true; credentials: { email: string; password: string } }
  | { success: false; errors: RegistrationErrors }

/** Applies the API contract's registration rules before submitting. */
export function validateRegistration(
  values: RegistrationValues,
): RegistrationValidationResult {
  const result = registrationSchema.safeParse(values)
  if (result.success) {
    const { email, password } = result.data
    return { success: true, credentials: { email, password } }
  }
  const { fieldErrors } = z.flattenError(result.error)
  return {
    success: false,
    errors: {
      email: fieldErrors.email?.[0],
      password: fieldErrors.password?.[0],
      passwordConfirmation: fieldErrors.passwordConfirmation?.[0],
    },
  }
}
