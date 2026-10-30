import { useQuery } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { currentApplicationQuery } from '../api/applicant-applications'
import { LocationProbe, renderRoutes } from '../test/render-routes'
import { server } from '../test/server'

import styles from './applicant-header.module.css'
import ApplicationsLayout from './applications'

const SESSION_URL = '/api/v1/applicant-sessions/current'
const CURRENT_URL = '/api/v1/applicant-applications/current'

/** A journey page that keeps the current application query observed. */
function JourneyPage() {
  const current = useQuery(currentApplicationQuery)
  return <main>{current.isSuccess ? 'Journey loaded' : 'Journey'}</main>
}

/**
 * Renders the layout over a journey page. The fake API ends the session on
 * sign-out with `status` and records any journey request made afterwards.
 */
function renderLayout(signOutResponse: () => Response) {
  let signedOut = false
  const requestsAfterSignOut: string[] = []
  server.use(
    http.get(CURRENT_URL, () => {
      if (signedOut) {
        requestsAfterSignOut.push('GET current')
        return new HttpResponse(null, { status: 401 })
      }
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(SESSION_URL, () => {
      const response = signOutResponse()
      signedOut = response.ok || response.status === 401
      return response
    }),
  )
  const view = renderRoutes(
    [
      {
        path: '/applications',
        Component: ApplicationsLayout,
        children: [{ path: 'current', Component: JourneyPage }],
      },
      {
        path: '/sign-in',
        Component: LocationProbe,
        // Like the real sign-in route, a loader keeps the journey on screen
        // while the router navigates, which re-renders it once more.
        loader: async () => {
          await delay(10)
          return null
        },
      },
    ],
    '/applications/current',
  )
  return { ...view, requestsAfterSignOut }
}

describe('ApplicationsLayout', () => {
  it.each([
    ['ends the session', 204],
    ['treats an already expired session as signed out', 401],
  ])(
    '%s, forgets cached applicant data and opens sign-in',
    async (_, status) => {
      const { user, queryClient, requestsAfterSignOut } = renderLayout(
        () => new HttpResponse(null, { status }),
      )

      expect(await screen.findByRole('banner')).toHaveTextContent(
        'KYC Application',
      )
      // White on the header blue; the DS default text colour fails contrast.
      expect(screen.getByText('KYC Application')).toHaveClass(styles.title)
      expect(await screen.findByText('Journey loaded')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Sign out' }))

      expect(
        await screen.findByRole('status', { name: 'Current location' }),
      ).toHaveTextContent(/^\/sign-in$/)
      expect(
        queryClient.getQueryCache().find({
          queryKey: currentApplicationQuery.queryKey,
        }),
      ).toBeUndefined()
      expect(requestsAfterSignOut).toEqual([])
    },
  )

  it('stays signed in and explains a failed sign-out', async () => {
    const { user, queryClient } = renderLayout(() => HttpResponse.error())

    expect(await screen.findByText('Journey loaded')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you out. We could not connect to the service.',
    )
    expect(screen.getByRole('main')).toHaveTextContent('Journey loaded')
    expect(
      queryClient.getQueryData(currentApplicationQuery.queryKey),
    ).toBeNull()
  })

  // Clicking it is covered end to end; these tests render without the app's
  // React Aria RouterProvider, which turns link clicks into navigation.
  it.each([
    ['another journey page', '/applications/other', undefined],
    ['the journey page itself', '/applications/current', 'page'],
  ])(
    'links the header title to the journey from %s',
    async (_, path, current) => {
      renderRoutes(
        [
          {
            path: '/applications',
            Component: ApplicationsLayout,
            children: [
              { path: 'current', Component: () => <main>Journey</main> },
              { path: 'other', Component: () => <main>Other page</main> },
            ],
          },
        ],
        path,
      )

      const home = await screen.findByRole('link', { name: 'KYC Application' })
      expect(home).toHaveAttribute('href', '/applications/current')
      if (current) {
        expect(home).toHaveAttribute('aria-current', current)
      } else {
        expect(home).not.toHaveAttribute('aria-current')
      }
    },
  )
})
