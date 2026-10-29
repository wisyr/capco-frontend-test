import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../test/server'

import {
  createApplicantSession,
  deleteApplicantSession,
} from './applicant-sessions'
import { UnexpectedResponseError } from './json-api-client'

const SESSIONS_URL = '/api/v1/applicant-sessions'

describe('createApplicantSession', () => {
  it('sends the credentials and returns the journey URL', async () => {
    let body: unknown
    server.use(
      http.post(SESSIONS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            data: {
              type: 'applicant-sessions',
              id: 'd40af2e3-b811-52ab-a43e-79e7d9139703',
              attributes: { href: '/applications/current' },
            },
          },
          { status: 201 },
        )
      }),
    )

    await expect(
      createApplicantSession({ email: 'ada@example.com', password: 'Secret!' }),
    ).resolves.toEqual({ journeyHref: '/applications/current' })
    expect(body).toEqual({
      data: {
        type: 'applicant-sessions',
        attributes: { email: 'ada@example.com', password: 'Secret!' },
      },
    })
  })

  it('rejects a success response without a journey URL', async () => {
    server.use(
      http.post(SESSIONS_URL, () =>
        HttpResponse.json(
          { data: { type: 'applicant-sessions', id: '1', attributes: {} } },
          { status: 201 },
        ),
      ),
    )

    await expect(
      createApplicantSession({ email: 'ada@example.com', password: 'Secret!' }),
    ).rejects.toBeInstanceOf(UnexpectedResponseError)
  })
})

describe('deleteApplicantSession', () => {
  it('signs out with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-3'
    let csrfToken: string | null = null
    server.use(
      http.delete(`${SESSIONS_URL}/current`, ({ request }) => {
        csrfToken = request.headers.get('X-XSRF-TOKEN')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(deleteApplicantSession()).resolves.toBeUndefined()
    expect(csrfToken).toBe('csrf-3')
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })
})
