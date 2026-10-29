import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { server } from '../test/server'

import {
  ApiError,
  jsonApiRequest,
  NetworkError,
  UnexpectedResponseError,
} from './json-api-client'

const JSON_API = 'application/vnd.api+json'

const documentSchema = z.object({
  data: z.object({ type: z.literal('things'), id: z.string() }),
})

function setCookie(value: string) {
  document.cookie = value
}

afterEach(() => {
  setCookie('XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT')
})

describe('jsonApiRequest', () => {
  it('sends a JSON:API document and returns the validated response', async () => {
    let request: Request | undefined
    server.use(
      http.post('/api/v1/things', ({ request: received }) => {
        request = received.clone()
        return HttpResponse.json(
          { data: { type: 'things', id: '1' } },
          { status: 201, headers: { 'Content-Type': JSON_API } },
        )
      }),
    )

    const result = await jsonApiRequest('/things', {
      method: 'POST',
      body: { data: { type: 'things' } },
      schema: documentSchema,
    })

    expect(result).toEqual({ data: { type: 'things', id: '1' } })
    expect(request?.headers.get('Accept')).toBe(JSON_API)
    expect(request?.headers.get('Content-Type')).toBe(JSON_API)
    expect(await request?.json()).toEqual({ data: { type: 'things' } })
  })

  it('omits the request content type when there is no body', async () => {
    let contentType: string | null = 'unset'
    server.use(
      http.get('/api/v1/things', ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await jsonApiRequest('/things', { schema: z.unknown() })

    expect(contentType).toBeNull()
  })

  it('sends the CSRF cookie value on state-changing requests only', async () => {
    setCookie('XSRF-TOKEN=token%2F1')
    const tokens: Record<string, string | null> = {}
    server.use(
      http.all('/api/v1/things', ({ request }) => {
        tokens[request.method] = request.headers.get('X-XSRF-TOKEN')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await jsonApiRequest('/things', { schema: z.unknown() })
    await jsonApiRequest('/things', {
      method: 'PATCH',
      body: {},
      schema: z.unknown(),
    })

    expect(tokens).toEqual({ GET: null, PATCH: 'token/1' })
  })

  it('validates an empty response body as undefined', async () => {
    server.use(
      http.get('/api/v1/things', () => new HttpResponse(null, { status: 204 })),
    )

    await expect(
      jsonApiRequest('/things', { schema: documentSchema.optional() }),
    ).resolves.toBeUndefined()
  })

  it('throws an ApiError with the JSON:API errors and Retry-After value', async () => {
    server.use(
      http.post('/api/v1/things', () =>
        HttpResponse.json(
          {
            errors: [
              {
                status: '400',
                code: 'validation-failed',
                title: 'Invalid attribute',
                detail: 'Enter a valid email address.',
                source: { pointer: '/data/attributes/email' },
              },
              {
                status: '400',
                code: 'malformed-document',
                title: 'Malformed JSON:API document',
                detail: 'The request body is not a valid JSON:API document.',
              },
            ],
          },
          { status: 400, headers: { 'Retry-After': '30' } },
        ),
      ),
    )

    const error = await jsonApiRequest('/things', {
      method: 'POST',
      body: {},
      schema: z.unknown(),
    }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(400)
    expect(apiError.retryAfterSeconds).toBe(30)
    expect(apiError.hasCode('validation-failed')).toBe(true)
    expect(apiError.hasCode('rate-limited')).toBe(false)
    expect(apiError.attributeErrors()).toEqual({
      email: 'Enter a valid email address.',
    })
  })

  it('throws an ApiError without details when the error body is not JSON:API', async () => {
    server.use(
      http.get(
        '/api/v1/things',
        () => new HttpResponse('Bad gateway', { status: 502 }),
      ),
    )

    const error = await jsonApiRequest('/things', {
      schema: z.unknown(),
    }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, errors: [] })
  })

  it('throws a NetworkError when no response is received', async () => {
    server.use(http.get('/api/v1/things', () => HttpResponse.error()))

    await expect(
      jsonApiRequest('/things', { schema: z.unknown() }),
    ).rejects.toBeInstanceOf(NetworkError)
  })

  it('throws an UnexpectedResponseError when a success response breaks the contract', async () => {
    server.use(
      http.get('/api/v1/things', () => HttpResponse.json({ data: null })),
    )

    await expect(
      jsonApiRequest('/things', { schema: documentSchema }),
    ).rejects.toBeInstanceOf(UnexpectedResponseError)
  })
})
