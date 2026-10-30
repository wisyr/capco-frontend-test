import { ApiError } from '../../api/json-api-client'

export interface CredentialFieldErrors {
  email?: string
  password?: string
}

/**
 * Email and password errors from a 400 credential response, located by their
 * source.pointer. Undefined when the response has no error for either field.
 */
export function credentialFieldErrors(
  error: unknown,
): CredentialFieldErrors | undefined {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return undefined
  }
  const { email, password } = error.attributeErrors()
  return email || password ? { email, password } : undefined
}
