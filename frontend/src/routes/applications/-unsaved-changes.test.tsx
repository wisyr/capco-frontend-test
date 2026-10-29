import { screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { LocationProbe, renderRoutes } from '../../test/render-routes'
import { server } from '../../test/server'
import ApplicationsLayout from '../applications'

import ApplicationStepPage, { parseStepParam } from './$applicationId/$step'
import { APPLICATION_ID, FORM_URL, formDocument } from './-step-test-utils'

expect.extend(toHaveNoViolations)

const SESSION_URL = '/api/v1/applicant-sessions/current'

/** Renders a step inside the journey layout, which owns the guard. */
function renderJourneyStep(step = 'personal-details') {
  const requests: string[] = []
  server.use(
    http.get(FORM_URL, () => HttpResponse.json(formDocument())),
    http.patch(FORM_URL, () => {
      requests.push('PATCH form')
      return HttpResponse.json(formDocument(undefined, { version: 8 }))
    }),
    http.delete(SESSION_URL, () => {
      requests.push('DELETE session')
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const view = renderRoutes(
    [
      {
        path: '/applications',
        Component: ApplicationsLayout,
        children: [
          { path: 'current', Component: LocationProbe },
          {
            path: ':applicationId/:step',
            Component: ApplicationStepPage,
            loader: ({ params }) => ({
              step: parseStepParam(params.step ?? ''),
            }),
          },
        ],
      },
      { path: '/sign-in', Component: LocationProbe },
    ],
    `/applications/${APPLICATION_ID}/${step}`,
  )
  return { ...view, requests }
}

const nameField = () => screen.findByLabelText('Name (required)')
const location = () => screen.findByRole('status', { name: 'Current location' })

async function editName(user: ReturnType<typeof renderJourneyStep>['user']) {
  const name = await nameField()
  await user.clear(name)
  await user.type(name, 'Grace Hopper')
}

describe('Leaving a step with unsaved answers', () => {
  it('asks first and keeps the answers when the applicant stays', async () => {
    const { user } = renderJourneyStep()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Leave without saving?',
    })
    expect(await axe(document.body)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'Stay on this page' }))

    expect(dialog).not.toBeInTheDocument()
    expect(await nameField()).toHaveValue('Grace Hopper')
    expect(
      screen.queryByRole('status', { name: 'Current location' }),
    ).not.toBeInTheDocument()
  })

  it('leaves when the applicant confirms', async () => {
    const { user } = renderJourneyStep()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(
      await screen.findByRole('button', { name: 'Leave without saving' }),
    )

    expect(await location()).toHaveTextContent(/^\/applications\/current$/)
  })

  it('treats a chosen document as unsaved', async () => {
    const { user } = renderJourneyStep('identity-and-address')

    await user.upload(
      await screen.findByLabelText('Document evidence (required)'),
      new File(['png-bytes'], 'passport.png', { type: 'image/png' }),
    )
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(
      await screen.findByRole('alertdialog', { name: 'Leave without saving?' }),
    ).toBeInTheDocument()
  })

  it('does not ask once the answers are saved', async () => {
    const { user } = renderJourneyStep()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Your answers have been saved.')
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(await location()).toHaveTextContent(/^\/applications\/current$/)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('does not ask when continuing saves the answers first', async () => {
    const { user, requests } = renderJourneyStep()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Identity and address',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requests).toEqual(['PATCH form'])
  })

  it('asks before signing out and only ends the session on confirmation', async () => {
    const { user, requests } = renderJourneyStep()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.click(
      await screen.findByRole('button', { name: 'Stay on this page' }),
    )
    expect(requests).toEqual([])
    expect(await nameField()).toHaveValue('Grace Hopper')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.click(
      await screen.findByRole('button', { name: 'Sign out without saving' }),
    )

    expect(await location()).toHaveTextContent(/^\/sign-in$/)
    expect(requests).toEqual(['DELETE session'])
  })

  it('asks the browser to confirm closing the tab only while answers are unsaved', async () => {
    const { user } = renderJourneyStep()
    const closeTab = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    await nameField()
    expect(closeTab()).toBe(false)

    await editName(user)
    expect(closeTab()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Your answers have been saved.')
    expect(closeTab()).toBe(false)
  })
})
