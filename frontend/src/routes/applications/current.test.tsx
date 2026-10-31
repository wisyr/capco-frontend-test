import { act, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LocationProbe, renderRoutes } from '../../test/render-routes'
import { server } from '../../test/server'

import CurrentApplicationJourneyPage from './current'
import { FORM_URL, formDocument } from './step-test-utils'

expect.extend(toHaveNoViolations)

const CURRENT_URL = '/api/v1/applicant-applications/current'
const APPLICATIONS_URL = '/api/v1/applicant-applications'
const APPLICATION_ID = '446971cf-e530-4ab7-9d24-74404a053de0'

function applicationDocument(href: string) {
  return {
    data: {
      type: 'applicant-applications',
      id: APPLICATION_ID,
      attributes: {
        status: 'draft',
        currentStep: 'identity-and-address',
        href,
        progress: [
          { step: 'personal-details', state: 'complete' },
          { step: 'identity-and-address', state: 'current' },
        ],
      },
    },
  }
}

function renderJourney() {
  return renderRoutes(
    [
      {
        path: '/applications/current',
        Component: CurrentApplicationJourneyPage,
      },
      { path: '/applications/:applicationId/:step', Component: LocationProbe },
      { path: '/sign-in', Component: LocationProbe },
    ],
    '/applications/current',
  )
}

const location = () => screen.findByRole('status', { name: 'Current location' })

type StepState = 'complete' | 'current' | 'remaining'

/** Serves the draft's form with these step states. */
function serveFormSteps(personal: StepState, identity: StepState) {
  const document = formDocument()
  document.data.attributes.steps = [
    { step: 'personal-details', state: personal },
    { step: 'identity-and-address', state: identity },
  ]
  server.use(http.get(FORM_URL, () => HttpResponse.json(document)))
}

const progressList = () =>
  screen.getByRole('list', { name: 'Application progress' })

beforeEach(() => serveFormSteps('complete', 'current'))

describe('CurrentApplicationJourneyPage', () => {
  it('starts a draft when the applicant has none and opens its first step', async () => {
    let created = 0
    server.use(
      http.get(CURRENT_URL, () => new HttpResponse(null, { status: 204 })),
      http.post(APPLICATIONS_URL, async () => {
        created += 1
        await delay(20)
        return HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/personal-details`,
          ),
          { status: 201 },
        )
      }),
    )
    const { user, container } = renderJourney()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your application…',
    )
    const start = await screen.findByRole('button', {
      name: 'Start application',
    })
    expect(await axe(container)).toHaveNoViolations()
    await user.click(start)

    expect(await location()).toHaveTextContent(
      `/applications/${APPLICATION_ID}/personal-details`,
    )
    expect(created).toBe(1)
  })

  it('resumes an existing draft at the journey URL from the API', async () => {
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/identity-and-address`,
          ),
        ),
      ),
    )
    const { user } = renderJourney()

    const resume = await screen.findByRole('button', {
      name: 'Resume application',
    })
    expect(
      screen.getByRole('list', { name: 'Application progress' }),
    ).toHaveTextContent(
      '1Personal detailsComplete2Identity and addressCurrent step',
    )
    await user.click(resume)

    expect(await location()).toHaveTextContent(
      `/applications/${APPLICATION_ID}/identity-and-address`,
    )
  })

  it('sends an applicant without a session to sign in and back', async () => {
    server.use(
      http.get(CURRENT_URL, () => new HttpResponse(null, { status: 401 })),
    )
    renderJourney()

    expect(await location()).toHaveTextContent(
      '/sign-in?returnTo=%2Fapplications%2Fcurrent state={"sessionExpired":true}',
    )
  })

  it('explains a failed start and lets the applicant retry', async () => {
    server.use(
      http.get(CURRENT_URL, () => new HttpResponse(null, { status: 204 })),
      http.post(APPLICATIONS_URL, () => HttpResponse.error()),
    )
    const { user } = renderJourney()

    await user.click(
      await screen.findByRole('button', { name: 'Start application' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not start your application. We could not connect to the service.',
    )
    expect(
      screen.getByRole('button', { name: 'Start application' }),
    ).toBeEnabled()
  })

  it('offers a retry when the draft cannot be loaded', async () => {
    let attempts = 0
    server.use(
      http.get(CURRENT_URL, () => {
        attempts += 1
        return attempts === 1
          ? new HttpResponse(null, { status: 503 })
          : new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderJourney()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your application.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('button', { name: 'Start application' }),
    ).toBeInTheDocument()
  })

  it('keeps showing the draft when a background refetch fails', async () => {
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/identity-and-address`,
          ),
        ),
      ),
    )
    const { queryClient } = renderJourney()
    await screen.findByRole('button', { name: 'Resume application' })

    server.use(
      http.get(CURRENT_URL, () => new HttpResponse(null, { status: 401 })),
    )
    await queryClient.refetchQueries()
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryState(['applicant-applications', 'current'])
          ?.status,
      ).toBe('error'),
    )
    // Give a redirect, if one were rendered, time to navigate.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)))

    expect(
      screen.getByRole('button', { name: 'Resume application' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: 'Current location' }),
    ).not.toBeInTheDocument()
  })

  it('refuses a journey URL outside the applicant journey', async () => {
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(applicationDocument('https://evil.example')),
      ),
    )
    renderJourney()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not open your application.',
    )
    expect(
      screen.queryByRole('button', { name: 'Resume application' }),
    ).not.toBeInTheDocument()
  })

  it('marks both steps complete and offers the review once the answers are complete', async () => {
    serveFormSteps('complete', 'complete')
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/identity-and-address`,
          ),
        ),
      ),
    )
    const { user, container } = renderJourney()

    const review = await screen.findByRole('button', {
      name: 'Review application',
    })
    expect(
      screen.getByRole('heading', { name: 'Review your KYC application' }),
    ).toBeInTheDocument()
    expect(progressList()).toHaveTextContent(
      '1Personal detailsComplete2Identity and addressComplete',
    )
    expect(await axe(container)).toHaveNoViolations()
    await user.click(review)

    expect(await location()).toHaveTextContent(
      `/applications/${APPLICATION_ID}/review`,
    )
  })

  it('shows the progress from the saved answers, not the draft', async () => {
    serveFormSteps('current', 'remaining')
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/personal-details`,
          ),
        ),
      ),
    )
    renderJourney()

    await screen.findByRole('button', { name: 'Resume application' })
    expect(progressList()).toHaveTextContent(
      '1Personal detailsCurrent step2Identity and addressRemaining',
    )
  })

  it("falls back to the draft's progress when the form cannot be loaded", async () => {
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/identity-and-address`,
          ),
        ),
      ),
      http.get(FORM_URL, () => new HttpResponse(null, { status: 503 })),
    )
    renderJourney()

    expect(
      await screen.findByRole('button', { name: 'Resume application' }),
    ).toBeInTheDocument()
    expect(progressList()).toHaveTextContent(
      '1Personal detailsComplete2Identity and addressCurrent step',
    )
  })

  it('sends the applicant to sign in when the form reports an ended session', async () => {
    server.use(
      http.get(CURRENT_URL, () =>
        HttpResponse.json(
          applicationDocument(
            `/applications/${APPLICATION_ID}/identity-and-address`,
          ),
        ),
      ),
      http.get(FORM_URL, () => new HttpResponse(null, { status: 401 })),
    )
    renderJourney()

    expect(await location()).toHaveTextContent(
      '/sign-in?returnTo=%2Fapplications%2Fcurrent',
    )
  })
})
