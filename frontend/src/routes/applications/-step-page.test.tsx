import { screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  APPLICATION_ID,
  FORM_URL,
  formDocument,
  renderStep,
} from './-step-test-utils'

expect.extend(toHaveNoViolations)

const field = (label: string) => screen.findByLabelText(`${label} (required)`)

describe('ApplicationStepPage loading', () => {
  it('fills every saved personal detail, including consent', async () => {
    server.use(
      http.get(FORM_URL, async () => {
        await delay(20)
        return HttpResponse.json(formDocument())
      }),
    )
    const { container } = renderStep('personal-details')

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Loading your saved answers…',
    )
    expect(await field('Name')).toHaveValue('Ada Lovelace')
    expect(await field('Date of birth')).toHaveValue('1815-12-10')
    expect(await field('Country')).toHaveValue('United Kingdom')
    expect(await field('Nationality')).toHaveValue('British')
    expect(await field('Email')).toHaveValue('ada@example.com')
    expect(await field('Phone')).toHaveValue('+44 20 7946 0000')
    expect(
      screen.getByRole('checkbox', { name: /I confirm these details/ }),
    ).toBeChecked()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Personal details' }),
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('fills every saved identity and address answer', async () => {
    server.use(http.get(FORM_URL, () => HttpResponse.json(formDocument())))
    renderStep('identity-and-address')

    expect(await field('Document type')).toHaveValue('Passport')
    expect(await field('Document number')).toHaveValue('123456789')
    expect(await field('Document country')).toHaveValue('United Kingdom')
    expect(await field('Expiry')).toHaveValue('2099-01-01')
    expect(await field('Street')).toHaveValue('12 St James Square')
    expect(await field('City')).toHaveValue('London')
    expect(await field('Postal code')).toHaveValue('SW1Y 4JH')
    expect(await field('Residential country')).toHaveValue('United Kingdom')
  })

  it.each([
    ['personal-details', 'Date of birth', '1990-04-23'],
    ['identity-and-address', 'Expiry', '2031-08-31'],
  ] as const)(
    'explains the date format expected on %s',
    async (step, label, example) => {
      server.use(http.get(FORM_URL, () => HttpResponse.json(formDocument())))
      renderStep(step)

      expect(await field(label)).toHaveAccessibleDescription(
        `Use year-month-day, for example ${example}.`,
      )
    },
  )

  it('leaves unanswered fields empty', async () => {
    server.use(
      http.get(FORM_URL, () =>
        HttpResponse.json(formDocument({ name: 'Ada', phone: null })),
      ),
    )
    renderStep('personal-details')

    expect(await field('Name')).toHaveValue('Ada')
    expect(await field('Phone')).toHaveValue('')
    expect(
      screen.getByRole('checkbox', { name: /I confirm these details/ }),
    ).not.toBeChecked()
  })

  it('sends an expired session to sign in and back to this step', async () => {
    server.use(
      http.get(FORM_URL, () => new HttpResponse(null, { status: 401 })),
    )
    renderStep('personal-details')

    expect(
      await screen.findByRole('status', { name: 'Current location' }),
    ).toHaveTextContent(
      `/sign-in?returnTo=%2Fapplications%2F${APPLICATION_ID}%2Fpersonal-details`,
    )
  })

  it('explains an application that is not available', async () => {
    server.use(
      http.get(FORM_URL, () => new HttpResponse(null, { status: 404 })),
    )
    renderStep('personal-details')

    expect(
      await screen.findByRole('heading', { name: 'Application not found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Go to your application' }),
    ).toHaveAttribute('href', '/applications/current')
  })

  it('offers a retry when the saved answers cannot be loaded', async () => {
    let attempts = 0
    server.use(
      http.get(FORM_URL, () => {
        attempts += 1
        return attempts === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(formDocument())
      }),
    )
    const { user } = renderStep('personal-details')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your saved answers.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await field('Name')).toHaveValue('Ada Lovelace')
  })

  it.each([
    ['an ended session', 401],
    ['a server error', 503],
  ])(
    'keeps unsaved answers when a background refetch fails with %s',
    async (_, status) => {
      server.use(http.get(FORM_URL, () => HttpResponse.json(formDocument())))
      const { user, queryClient } = renderStep('personal-details')
      await user.type(await field('Name'), ' unsaved')

      server.use(http.get(FORM_URL, () => new HttpResponse(null, { status })))
      await queryClient.refetchQueries()

      expect(await field('Name')).toHaveValue('Ada Lovelace unsaved')
      expect(
        screen.queryByRole('status', { name: 'Current location' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    },
  )

  it('treats an unknown step as a missing page', async () => {
    renderStep('somewhere-else')

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})
