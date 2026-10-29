import { QueryClient } from '@tanstack/react-query'

import { ApiError, UnexpectedResponseError } from './json-api-client'

const MAX_QUERY_RETRIES = 2

/**
 * Retries queries only for failures that may be transient. A 4xx answer such
 * as an expired session (401) or a contract mismatch will not change on retry,
 * and retrying would delay the feedback the applicant needs.
 */
export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (error instanceof UnexpectedResponseError) {
    return false
  }
  if (error instanceof ApiError && error.status < 500) {
    return false
  }
  return failureCount < MAX_QUERY_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      // Writes are never retried automatically; the applicant decides.
      mutations: { retry: false },
    },
  })
}
