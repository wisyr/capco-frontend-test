import { Navigate, useLocation } from 'react-router'

import { accountAccessHref } from '../-return-target'
import { ApiError } from '../../api/json-api-client'

/** Location state the sign-in page reads to explain why it is shown. */
export interface SignInLocationState {
  sessionExpired: true
}

/** True when the API reports that the Applicant has no active session. */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

/** Sends the Applicant to sign in, then back to the current journey page. */
export function SessionExpiredRedirect() {
  const { pathname } = useLocation()
  const state: SignInLocationState = { sessionExpired: true }
  return (
    <Navigate
      replace
      state={state}
      to={accountAccessHref('/sign-in', pathname)}
    />
  )
}
