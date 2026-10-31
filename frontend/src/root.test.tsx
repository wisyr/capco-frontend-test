import { screen, waitFor } from '@testing-library/react'
import { data } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ErrorBoundary } from './root'
import SubmissionReceiptPage from './routes/applications/submitted'
import { renderRoutes } from './test/render-routes'

function renderFailingRoute(error: unknown) {
  return renderRoutes(
    [
      {
        path: '/broken',
        loader: () => {
          throw error
        },
        Component: () => null,
        ErrorBoundary,
      },
    ],
    '/broken',
  )
}

describe('ErrorBoundary', () => {
  it('names a missing page in the heading and the page title', async () => {
    renderFailingRoute(data(null, { status: 404 }))

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Page not found | KYC'))
    expect(
      screen.getByRole('link', { name: 'Go to your application' }),
    ).toHaveAttribute('href', '/applications/current')
  })

  it('names an unexpected failure in the heading and the page title', async () => {
    renderFailingRoute(new Error('boom'))

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(document.title).toBe('Something went wrong | KYC'),
    )
    expect(
      screen.getByRole('link', { name: 'Go to your application' }),
    ).toBeInTheDocument()
  })
})

describe('SubmissionReceiptPage', () => {
  it('sets the page title', async () => {
    renderRoutes(
      [{ path: '/submitted', Component: SubmissionReceiptPage }],
      '/submitted',
    )

    await waitFor(() =>
      expect(document.title).toBe('Application submitted | KYC'),
    )
  })
})
