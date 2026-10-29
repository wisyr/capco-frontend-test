import { z } from 'zod'

import { jsonApiRequest } from './json-api-client'

export interface ApplicantCredentials {
  email: string
  password: string
}

/** Registers an Applicant account. It does not sign the Applicant in. */
export async function createApplicantAccount(
  credentials: ApplicantCredentials,
): Promise<void> {
  await jsonApiRequest('/applicant-accounts', {
    method: 'POST',
    body: { data: { type: 'applicant-accounts', attributes: credentials } },
    // A 201 response has no body; the Location header is not needed here.
    schema: z.unknown(),
  })
}
