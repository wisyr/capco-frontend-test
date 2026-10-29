import { ApiError, NetworkError } from './json-api-client'

/**
 * User-facing message for failures every screen handles the same way:
 * no connection, rate limiting, and responses the screen does not expect.
 */
export function requestFailureMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'We could not connect to the service. Check your internet connection and try again.'
  }
  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfterSeconds
      ? `Too many attempts. Wait ${formatWait(error.retryAfterSeconds)} and try again.`
      : 'Too many attempts. Wait a few minutes and try again.'
  }
  return 'Something went wrong. Try again later.'
}

function formatWait(seconds: number): string {
  if (seconds < 60) {
    return seconds === 1 ? '1 second' : `${seconds} seconds`
  }
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
