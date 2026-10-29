import { z } from 'zod'

const API_BASE_PATH = '/api/v1'
const JSON_API_MEDIA_TYPE = 'application/vnd.api+json'
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const ATTRIBUTE_POINTER_PREFIX = '/data/attributes/'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

const jsonApiErrorSchema = z.object({
  status: z.string(),
  code: z.string(),
  title: z.string(),
  detail: z.string(),
  source: z.object({ pointer: z.string() }).optional(),
})

const errorDocumentSchema = z.object({
  errors: z.array(jsonApiErrorSchema).min(1),
})

export type JsonApiError = z.infer<typeof jsonApiErrorSchema>

/** The API answered with a non-2xx status. */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly status: number
  readonly errors: readonly JsonApiError[]
  /** Seconds from the Retry-After header, when the API sent one. */
  readonly retryAfterSeconds: number | undefined

  constructor(
    status: number,
    errors: readonly JsonApiError[],
    retryAfterSeconds?: number,
  ) {
    super(errors[0]?.detail ?? `API request failed with status ${status}.`)
    this.status = status
    this.errors = errors
    this.retryAfterSeconds = retryAfterSeconds
  }

  hasCode(code: string): boolean {
    return this.errors.some((error) => error.code === code)
  }

  /** Error details keyed by the attribute their source.pointer identifies. */
  attributeErrors(): Partial<Record<string, string>> {
    const result: Partial<Record<string, string>> = {}
    for (const { source, detail } of this.errors) {
      const pointer = source?.pointer
      if (pointer?.startsWith(ATTRIBUTE_POINTER_PREFIX)) {
        result[pointer.slice(ATTRIBUTE_POINTER_PREFIX.length)] ??= detail
      }
    }
    return result
  }
}

/** The request never produced a response, for example when offline. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError'
}

/** A successful response did not match the documented contract. */
export class UnexpectedResponseError extends Error {
  override readonly name = 'UnexpectedResponseError'
}

interface RequestOptions<T> {
  method?: HttpMethod
  /** JSON:API document to send as the request body. */
  body?: unknown
  /** Validates the response document; use `z.unknown()` to ignore it. */
  schema: z.ZodType<T>
  signal?: AbortSignal
}

/**
 * Sends a JSON:API request to the versioned API and returns the response
 * document validated by `schema`. A response without a body is validated as
 * `undefined`. State-changing requests carry the CSRF token from the
 * XSRF-TOKEN cookie when one is present.
 */
export async function jsonApiRequest<T>(
  path: string,
  { method = 'GET', body, schema, signal }: RequestOptions<T>,
): Promise<T> {
  const headers = new Headers({ Accept: JSON_API_MEDIA_TYPE })
  if (body !== undefined) {
    headers.set('Content-Type', JSON_API_MEDIA_TYPE)
  }
  const csrfToken = method === 'GET' ? undefined : readCookie(CSRF_COOKIE_NAME)
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    })
  } catch (cause) {
    if (signal?.aborted) {
      throw cause
    }
    throw new NetworkError('The API could not be reached.', { cause })
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorDocumentSchema.safeParse(await readJson(response)).data?.errors ??
        [],
      parseRetryAfter(response.headers.get('Retry-After')),
    )
  }

  const document = schema.safeParse(await readJson(response))
  if (!document.success) {
    throw new UnexpectedResponseError(
      `Unexpected response from ${method} ${path}.`,
      { cause: document.error },
    )
  }
  return document.data
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  const seconds = Number(value)
  return value && Number.isInteger(seconds) && seconds > 0 ? seconds : undefined
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}
