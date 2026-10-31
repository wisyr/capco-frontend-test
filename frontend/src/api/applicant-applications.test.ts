import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '../test/server'

import {
  getApplicationForm,
  getApplicationReview,
  getCurrentApplication,
  saveApplicationForm,
  startApplication,
  uploadDocumentEvidence,
} from './applicant-applications'
import { ApiError } from './json-api-client'

const APPLICATION_ID = '446971cf-e530-4ab7-9d24-74404a053de0'

const applicationDocument = {
  data: {
    type: 'applicant-applications',
    id: APPLICATION_ID,
    attributes: {
      status: 'draft',
      currentStep: 'personal-details',
      href: `/applications/${APPLICATION_ID}/personal-details`,
      progress: [
        { step: 'personal-details', state: 'current' },
        { step: 'identity-and-address', state: 'not-started' },
      ],
    },
  },
}

function formDocument(answers: object, version = 3) {
  return {
    data: {
      type: 'applicant-application-forms',
      id: APPLICATION_ID,
      attributes: {
        status: 'draft',
        currentStep: 'personal-details',
        steps: [
          { step: 'personal-details', state: 'current' },
          { step: 'identity-and-address', state: 'remaining' },
        ],
        answers,
        documentEvidence: { present: true },
        version,
      },
    },
  }
}

const expectedApplication = {
  id: APPLICATION_ID,
  href: `/applications/${APPLICATION_ID}/personal-details`,
  progress: [
    { step: 'personal-details', state: 'current' },
    { step: 'identity-and-address', state: 'not-started' },
  ],
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('getCurrentApplication', () => {
  it('returns the current draft', async () => {
    server.use(
      http.get('/api/v1/applicant-applications/current', () =>
        HttpResponse.json(applicationDocument),
      ),
    )

    await expect(getCurrentApplication()).resolves.toEqual(expectedApplication)
  })

  it('returns null when no draft has been started', async () => {
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(getCurrentApplication()).resolves.toBeNull()
  })

  it('reports an expired session as a 401 ApiError', async () => {
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: 401 }),
      ),
    )

    await expect(getCurrentApplication()).rejects.toMatchObject({
      constructor: ApiError,
      status: 401,
    })
  })
})

describe('startApplication', () => {
  it('posts with the CSRF token and returns the draft', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-1'
    let csrfToken: string | null = null
    server.use(
      http.post('/api/v1/applicant-applications', ({ request }) => {
        csrfToken = request.headers.get('X-XSRF-TOKEN')
        return HttpResponse.json(applicationDocument, { status: 201 })
      }),
    )

    await expect(startApplication()).resolves.toEqual(expectedApplication)
    expect(csrfToken).toBe('csrf-1')
  })
})

describe('getApplicationForm', () => {
  it('returns saved answers, document presence and version', async () => {
    server.use(
      http.get(`/api/v1/applicant-applications/${APPLICATION_ID}/form`, () =>
        HttpResponse.json(
          formDocument({ name: 'Ada', phone: null, consentConfirmed: true }),
        ),
      ),
    )

    await expect(getApplicationForm(APPLICATION_ID)).resolves.toEqual({
      applicationId: APPLICATION_ID,
      answers: { name: 'Ada', phone: null, consentConfirmed: true },
      steps: [
        { step: 'personal-details', state: 'current' },
        { step: 'identity-and-address', state: 'remaining' },
      ],
      documentEvidencePresent: true,
      version: 3,
    })
  })
})

describe('getApplicationReview', () => {
  it('returns readiness and the missing fields by step', async () => {
    const missingRequiredFields = [
      { step: 'personal-details', field: 'name' },
      { step: 'identity-and-address', field: 'documentEvidence' },
    ]
    server.use(
      http.get(`/api/v1/applicant-applications/${APPLICATION_ID}/review`, () =>
        HttpResponse.json({
          data: {
            type: 'applicant-application-reviews',
            id: APPLICATION_ID,
            attributes: { ready: false, missingRequiredFields },
          },
        }),
      ),
    )

    await expect(getApplicationReview(APPLICATION_ID)).resolves.toEqual({
      ready: false,
      missingRequiredFields,
    })
  })
})

describe('saveApplicationForm', () => {
  it('patches one step with the expected version and returns the saved form', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-2'
    let request: Request | undefined
    server.use(
      http.patch(
        `/api/v1/applicant-applications/${APPLICATION_ID}/form`,
        ({ request: received }) => {
          request = received.clone()
          return HttpResponse.json(formDocument({ name: 'Ada Lovelace' }, 4))
        },
      ),
    )

    const saved = await saveApplicationForm(APPLICATION_ID, {
      step: 'personal-details',
      answers: { name: 'Ada Lovelace', phone: '' },
      version: 3,
    })

    expect(saved.version).toBe(4)
    expect(request?.headers.get('X-XSRF-TOKEN')).toBe('csrf-2')
    expect(request?.headers.get('Content-Type')).toBe(
      'application/vnd.api+json',
    )
    expect(await request?.json()).toEqual({
      data: {
        type: 'applicant-application-forms',
        id: APPLICATION_ID,
        attributes: {
          step: 'personal-details',
          answers: { name: 'Ada Lovelace', phone: '' },
          version: 3,
        },
      },
    })
  })

  it('reports a stale version as a 409 ApiError', async () => {
    server.use(
      http.patch(`/api/v1/applicant-applications/${APPLICATION_ID}/form`, () =>
        HttpResponse.json(
          {
            errors: [
              {
                status: '409',
                code: 'form-version-conflict',
                title: 'Form changed',
                detail: 'Reload the form and try again.',
              },
            ],
          },
          { status: 409 },
        ),
      ),
    )

    const error = await saveApplicationForm(APPLICATION_ID, {
      step: 'personal-details',
      answers: {},
      version: 1,
    }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).hasCode('form-version-conflict')).toBe(true)
  })
})

describe('uploadDocumentEvidence', () => {
  it('uploads the image as the multipart file part with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-4'
    let request: Request | undefined
    server.use(
      http.post(
        `/api/v1/applicant-applications/${APPLICATION_ID}/document-evidence`,
        ({ request: received }) => {
          request = received.clone()
          return HttpResponse.json(
            {
              data: {
                type: 'applicant-application-document-evidence',
                id: APPLICATION_ID,
                attributes: { present: true },
              },
            },
            { status: 201 },
          )
        },
      ),
    )
    const image = new File(['png'], 'passport.png', { type: 'image/png' })

    await expect(
      uploadDocumentEvidence(APPLICATION_ID, image),
    ).resolves.toEqual({ present: true })
    expect(request?.headers.get('X-XSRF-TOKEN')).toBe('csrf-4')
    const file = (await request?.formData())?.get('file') as File
    expect(file.name).toBe('passport.png')
    expect(file.type).toBe('image/png')
  })
})
