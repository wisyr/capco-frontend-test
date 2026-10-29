import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { jsonApiRequest } from './json-api-client'

export const applicationSteps = [
  'personal-details',
  'identity-and-address',
] as const
export type ApplicationStep = (typeof applicationSteps)[number]

const stepSchema = z.enum(applicationSteps)

const currentApplicationDocumentSchema = z.object({
  data: z.object({
    type: z.literal('applicant-applications'),
    id: z.string(),
    attributes: z.object({
      status: z.literal('draft'),
      currentStep: stepSchema,
      href: z.string(),
      progress: z.array(
        z.object({
          step: stepSchema,
          state: z.enum(['not-started', 'current', 'complete']),
        }),
      ),
    }),
  }),
})

type CurrentApplicationDocument = z.infer<
  typeof currentApplicationDocumentSchema
>

/** The Applicant's draft application and where its journey continues. */
export interface CurrentApplication {
  id: string
  href: string
  progress: CurrentApplicationDocument['data']['attributes']['progress']
}

const answersSchema = z.object({
  name: z.string().nullish(),
  dateOfBirth: z.string().nullish(),
  country: z.string().nullish(),
  nationality: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  consentConfirmed: z.boolean().nullish(),
  documentType: z.string().nullish(),
  documentNumber: z.string().nullish(),
  documentCountry: z.string().nullish(),
  expiry: z.string().nullish(),
  street: z.string().nullish(),
  city: z.string().nullish(),
  postal: z.string().nullish(),
  residentialCountry: z.string().nullish(),
})

/** Saved answers keyed by API field name; unanswered fields may be absent. */
export type Answers = z.infer<typeof answersSchema>

const formDocumentSchema = z.object({
  data: z.object({
    type: z.literal('applicant-application-forms'),
    id: z.string(),
    attributes: z.object({
      status: z.literal('draft'),
      currentStep: stepSchema,
      steps: z.array(
        z.object({
          step: stepSchema,
          state: z.enum(['current', 'complete', 'remaining']),
        }),
      ),
      answers: answersSchema,
      documentEvidence: z.object({ present: z.boolean() }),
      version: z.number().int().optional(),
    }),
  }),
})

/** The persisted draft form, including its optimistic-concurrency version. */
export interface ApplicationForm {
  applicationId: string
  answers: Answers
  documentEvidencePresent: boolean
  version: number | undefined
}

export interface SaveFormRequest {
  step: ApplicationStep
  /** Only fields that belong to `step`; an empty string clears a field. */
  answers: Answers
  version: number | undefined
}

/** Returns the Applicant's draft, or null when they have not started one. */
export async function getCurrentApplication(): Promise<CurrentApplication | null> {
  const document = await jsonApiRequest('/applicant-applications/current', {
    // 204 No Content means there is no draft yet.
    schema: currentApplicationDocumentSchema.optional(),
  })
  return document ? toCurrentApplication(document) : null
}

/** Starts a draft, or returns the existing one so drafts are never duplicated. */
export async function startApplication(): Promise<CurrentApplication> {
  const document = await jsonApiRequest('/applicant-applications', {
    method: 'POST',
    schema: currentApplicationDocumentSchema,
  })
  return toCurrentApplication(document)
}

export async function getApplicationForm(
  applicationId: string,
): Promise<ApplicationForm> {
  return toApplicationForm(
    await jsonApiRequest(formPath(applicationId), {
      schema: formDocumentSchema,
    }),
  )
}

/** Saves one step's answers and returns the form as the API persisted it. */
export async function saveApplicationForm(
  applicationId: string,
  { step, answers, version }: SaveFormRequest,
): Promise<ApplicationForm> {
  return toApplicationForm(
    await jsonApiRequest(formPath(applicationId), {
      method: 'PATCH',
      body: {
        data: {
          type: 'applicant-application-forms',
          id: applicationId,
          attributes: { step, answers, version },
        },
      },
      schema: formDocumentSchema,
    }),
  )
}

export const currentApplicationQuery = queryOptions({
  queryKey: ['applicant-applications', 'current'],
  queryFn: getCurrentApplication,
})

export function applicationFormQuery(applicationId: string) {
  return queryOptions({
    queryKey: ['applicant-applications', applicationId, 'form'],
    queryFn: () => getApplicationForm(applicationId),
  })
}

function formPath(applicationId: string) {
  return `/applicant-applications/${encodeURIComponent(applicationId)}/form`
}

function toCurrentApplication({
  data,
}: CurrentApplicationDocument): CurrentApplication {
  return {
    id: data.id,
    href: data.attributes.href,
    progress: data.attributes.progress,
  }
}

function toApplicationForm({
  data,
}: z.infer<typeof formDocumentSchema>): ApplicationForm {
  return {
    applicationId: data.id,
    answers: data.attributes.answers,
    documentEvidencePresent: data.attributes.documentEvidence.present,
    version: data.attributes.version,
  }
}
