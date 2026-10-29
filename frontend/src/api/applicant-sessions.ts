import { z } from 'zod'

import { jsonApiRequest } from './json-api-client'

import type { ApplicantCredentials } from './applicant-accounts'

const sessionDocumentSchema = z.object({
  data: z.object({
    type: z.literal('applicant-sessions'),
    id: z.string(),
    attributes: z.object({ href: z.string() }),
  }),
})

/**
 * Signs an Applicant in. The browser stores the HttpOnly session cookie and
 * the XSRF-TOKEN cookie from the response; the returned value is the journey
 * URL the API directs the Applicant to.
 */
export async function createApplicantSession(
  credentials: ApplicantCredentials,
): Promise<{ journeyHref: string }> {
  const session = await jsonApiRequest('/applicant-sessions', {
    method: 'POST',
    body: { data: { type: 'applicant-sessions', attributes: credentials } },
    schema: sessionDocumentSchema,
  })
  return { journeyHref: session.data.attributes.href }
}

/** Ends the Applicant's session; the API clears the session cookie. */
export async function deleteApplicantSession(): Promise<void> {
  await jsonApiRequest('/applicant-sessions/current', {
    method: 'DELETE',
    // A 204 response has no body.
    schema: z.unknown(),
  })
}
