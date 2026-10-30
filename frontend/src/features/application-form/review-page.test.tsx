import { screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { LocationProbe, renderRoutes } from '../../test/render-routes'

import { ReviewPage } from './review-page'

expect.extend(toHaveNoViolations)

const APPLICATION_ID = '446971cf-e530-4ab7-9d24-74404a053de0'

function renderReview() {
  return renderRoutes(
    [
      {
        path: '/applications/:applicationId/review',
        Component: () => <ReviewPage applicationId={APPLICATION_ID} />,
      },
      {
        path: '/applications/:applicationId/submitted',
        Component: LocationProbe,
      },
    ],
    `/applications/${APPLICATION_ID}/review`,
  )
}

const confirmation = () =>
  screen.getByRole('checkbox', { name: /I confirm the information/ })
const submitButton = () => screen.getByRole('button', { name: 'Submit' })

describe('ReviewPage', () => {
  it('requires the confirmation before submitting', async () => {
    const { user, container } = renderReview()

    await user.click(submitButton())

    expect(confirmation()).toHaveFocus()
    expect(confirmation()).toBeInvalid()
    expect(confirmation()).toHaveAccessibleDescription(
      'Confirm that the information is complete and accurate.',
    )
    expect(
      screen.queryByRole('status', { name: 'Current location' }),
    ).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('clears the error once confirmed and then submits', async () => {
    const { user } = renderReview()

    await user.click(submitButton())
    await user.click(confirmation())

    expect(confirmation()).not.toHaveAttribute('aria-invalid')

    await user.click(submitButton())

    expect(
      await screen.findByRole('status', { name: 'Current location' }),
    ).toHaveTextContent(`/applications/${APPLICATION_ID}/submitted`)
  })
})
