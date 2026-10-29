import { describe, expect, it } from 'vitest'

import {
  ApiError,
  NetworkError,
  UnexpectedResponseError,
} from './json-api-client'
import { shouldRetryQuery } from './query-client'

describe('shouldRetryQuery', () => {
  it.each([401, 403, 404])('does not retry a %s response', (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, []))).toBe(false)
  })

  it('does not retry a response that breaks the contract', () => {
    expect(shouldRetryQuery(0, new UnexpectedResponseError('bad'))).toBe(false)
  })

  it('retries server and network failures twice', () => {
    expect(shouldRetryQuery(0, new ApiError(503, []))).toBe(true)
    expect(shouldRetryQuery(1, new NetworkError('offline'))).toBe(true)
    expect(shouldRetryQuery(2, new NetworkError('offline'))).toBe(false)
  })
})
