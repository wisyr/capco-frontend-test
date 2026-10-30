import { screen, within } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  APPLICATION_ID,
  FORM_URL,
  formDocument,
  renderStep,
  REVIEW_URL,
  reviewDocument,
  savedAnswers,
} from './step-test-utils'

expect.extend(toHaveNoViolations)

function serveReview(...documents: ReturnType<typeof reviewDocument>[]) {
  let requests = 0
  server.use(
    http.get(REVIEW_URL, () => {
      const document = documents[Math.min(requests, documents.length - 1)]
      requests += 1
      return HttpResponse.json(document)
    }),
  )
}

describe('review page readiness', () => {
  it('lists missing answers by step and does not offer Submit', async () => {
    serveReview(
      reviewDocument([
        { step: 'personal-details', field: 'name' },
        { step: 'personal-details', field: 'consentConfirmed' },
        { step: 'identity-and-address', field: 'documentEvidence' },
      ]),
    )
    const { container } = renderStep('review')

    expect(
      await screen.findByText(/Your application is not ready to submit yet/),
    ).toBeInTheDocument()
    const personal = screen.getByRole('region', { name: 'Personal details' })
    expect(
      within(personal)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Name', 'Confirmation that these details are yours'])
    expect(
      within(personal).getByRole('link', { name: 'Complete personal details' }),
    ).toHaveAttribute(
      'href',
      `/applications/${APPLICATION_ID}/personal-details`,
    )
    const identity = screen.getByRole('region', {
      name: 'Identity and address',
    })
    expect(within(identity).getByRole('listitem')).toHaveTextContent(
      'Document evidence',
    )
    expect(
      within(identity).getByRole('link', {
        name: 'Complete identity and address',
      }),
    ).toHaveAttribute(
      'href',
      `/applications/${APPLICATION_ID}/identity-and-address`,
    )
    expect(
      screen.queryByRole('button', { name: 'Submit' }),
    ).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('offers the confirmation and Submit once the API reports ready', async () => {
    serveReview(reviewDocument())
    renderStep('review')

    expect(
      await screen.findByText(/All required answers are saved/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /I confirm the information/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('sends an expired session to sign in and back to the review', async () => {
    server.use(
      http.get(REVIEW_URL, () => new HttpResponse(null, { status: 401 })),
    )
    renderStep('review')

    expect(
      await screen.findByRole('status', { name: 'Current location' }),
    ).toHaveTextContent(
      `/sign-in?returnTo=%2Fapplications%2F${APPLICATION_ID}%2Freview`,
    )
  })

  it('offers a retry when readiness cannot be checked', async () => {
    let attempts = 0
    server.use(
      http.get(REVIEW_URL, () => {
        attempts += 1
        return attempts === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(reviewDocument())
      }),
    )
    const { user } = renderStep('review')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not check your application.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('button', { name: 'Submit' }),
    ).toBeInTheDocument()
  })

  it('checks readiness again after a save instead of showing the old result', async () => {
    server.use(
      http.get(REVIEW_URL, async () => {
        await delay(20)
        return HttpResponse.json(reviewDocument())
      }),
    )
    server.use(
      http.get(FORM_URL, () =>
        HttpResponse.json(
          formDocument(savedAnswers, { documentPresent: true }),
        ),
      ),
      http.patch(FORM_URL, () =>
        HttpResponse.json(
          formDocument(savedAnswers, { version: 8, documentPresent: true }),
        ),
      ),
    )
    const { queryClient, user } = renderStep('identity-and-address')
    // A result from an earlier visit, before the document was uploaded.
    queryClient.setQueryData(
      ['applicant-applications', APPLICATION_ID, 'review'],
      {
        ready: false,
        missingRequiredFields: [
          { step: 'identity-and-address', field: 'documentEvidence' },
        ],
      },
    )

    await user.type(await screen.findByLabelText('City (required)'), ' Centre')
    await user.click(screen.getByRole('button', { name: 'Save and review' }))

    expect(
      await screen.findByText('Checking your application…'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/not ready to submit yet/),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Submit' }),
    ).toBeInTheDocument()
  })
})
