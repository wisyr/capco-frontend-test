import { useLocation, useNavigate } from 'react-router'

import { parseAccountAccessSearch } from './-return-target'
import { SignInForm } from './-sign-in-form'

import type { Route } from './+types/sign-in'
import type { SignInLocationState } from './applications/-session'

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const search = Object.fromEntries(new URL(request.url).searchParams)
  return parseAccountAccessSearch(search)
}

export default function SignInRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const sessionExpired =
    (state as Partial<SignInLocationState> | null)?.sessionExpired === true
  return (
    <SignInForm
      notice={
        sessionExpired
          ? 'Your session has ended. Sign in again to continue.'
          : undefined
      }
      onSuccess={(href) => {
        // Replace sign-in in history so Back does not return to the form.
        void navigate(href, { replace: true })
      }}
      returnTo={loaderData.returnTo}
    />
  )
}
