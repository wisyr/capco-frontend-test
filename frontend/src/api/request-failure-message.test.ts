import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from './json-api-client'
import { requestFailureMessage } from './request-failure-message'

describe('requestFailureMessage', () => {
  it('explains a connection failure', () => {
    expect(requestFailureMessage(new NetworkError('offline'))).toMatch(
      /could not connect.*check your internet connection/i,
    )
  })

  it.each([
    [undefined, 'Too many attempts. Wait a few minutes and try again.'],
    [1, 'Too many attempts. Wait 1 second and try again.'],
    [45, 'Too many attempts. Wait 45 seconds and try again.'],
    [60, 'Too many attempts. Wait 1 minute and try again.'],
    [61, 'Too many attempts. Wait 2 minutes and try again.'],
  ])('uses Retry-After %s for rate limiting', (retryAfter, message) => {
    expect(requestFailureMessage(new ApiError(429, [], retryAfter))).toBe(
      message,
    )
  })

  it('falls back to a generic message', () => {
    expect(requestFailureMessage(new ApiError(500, []))).toBe(
      'Something went wrong. Try again later.',
    )
    expect(requestFailureMessage(new Error('boom'))).toBe(
      'Something went wrong. Try again later.',
    )
  })
})
