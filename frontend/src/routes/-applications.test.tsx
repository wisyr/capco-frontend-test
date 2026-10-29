import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { LocationProbe, renderRoutes } from '../test/render-routes'
import { server } from '../test/server'

import ApplicationsLayout from './applications'

const SESSION_URL = '/api/v1/applicant-sessions/current'

function renderLayout() {
  const view = renderRoutes(
    [
      {
        path: '/applications',
        Component: ApplicationsLayout,
        children: [{ path: 'current', Component: () => <main>Journey</main> }],
      },
      { path: '/sign-in', Component: LocationProbe },
    ],
    '/applications/current',
  )
  view.queryClient.setQueryData(['applicant-applications', 'current'], {
    id: 'cached-draft',
  })
  return view
}

const signOutButton = () => screen.getByRole('button', { name: 'Sign out' })

describe('ApplicationsLayout', () => {
  it.each([
    ['ends the session', 204],
    ['treats an already expired session as signed out', 401],
  ])(
    '%s, forgets cached applicant data and opens sign-in',
    async (_, status) => {
      server.use(
        http.delete(SESSION_URL, () => new HttpResponse(null, { status })),
      )
      const { user, queryClient } = renderLayout()

      expect(await screen.findByRole('banner')).toHaveTextContent(
        'KYC Application',
      )
      await user.click(signOutButton())

      expect(
        await screen.findByRole('status', { name: 'Current location' }),
      ).toHaveTextContent('/sign-in')
      expect(
        queryClient.getQueryData(['applicant-applications', 'current']),
      ).toBeUndefined()
    },
  )

  it('stays signed in and explains a failed sign-out', async () => {
    server.use(http.delete(SESSION_URL, () => HttpResponse.error()))
    const { user, queryClient } = renderLayout()

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you out. We could not connect to the service.',
    )
    expect(screen.getByRole('main')).toHaveTextContent('Journey')
    expect(
      queryClient.getQueryData(['applicant-applications', 'current']),
    ).toEqual({ id: 'cached-draft' })
  })
})
