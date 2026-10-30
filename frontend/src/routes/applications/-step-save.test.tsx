import { screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  APPLICATION_ID,
  FORM_URL,
  formDocument,
  renderStep,
  savedAnswers,
} from './-step-test-utils'

expect.extend(toHaveNoViolations)

const nameField = () => screen.findByLabelText('Name (required)')
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const savedNotice = () => screen.queryByText('Your answers have been saved.')

function errorDocument(status: number, code: string, detail: string) {
  return {
    errors: [{ status: String(status), code, title: 'Error', detail }],
  }
}

/** Serves the saved form and records every PATCH request body. */
function serveForm({
  patch,
}: {
  patch?: (body: unknown) => Response | Promise<Response>
} = {}) {
  const patches: unknown[] = []
  server.use(
    http.get(FORM_URL, () => HttpResponse.json(formDocument())),
    http.patch(FORM_URL, async ({ request }) => {
      const body = await request.json()
      patches.push(body)
      return patch
        ? patch(body)
        : HttpResponse.json(
            formDocument(savedAnswers, { version: 7 + patches.length }),
          )
    }),
  )
  return patches
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('ApplicationStepPage saving', () => {
  it('saves only this step with the CSRF token and confirms after the API does', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token'
    let csrfToken: string | null = null
    const patches: unknown[] = []
    server.use(
      http.get(FORM_URL, () => HttpResponse.json(formDocument())),
      http.patch(FORM_URL, async ({ request }) => {
        csrfToken = request.headers.get('X-XSRF-TOKEN')
        patches.push(await request.json())
        await delay(30)
        return HttpResponse.json(formDocument(savedAnswers, { version: 8 }))
      }),
    )
    const { user, container } = renderStep('personal-details')

    await user.clear(await nameField())
    await user.type(await nameField(), 'Ada King')
    await user.clear(screen.getByLabelText('Phone (required)'))
    await user.click(saveButton())

    expect(screen.getByText('Saving your answers…')).toBeInTheDocument()
    expect(savedNotice()).not.toBeInTheDocument()
    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    expect(csrfToken).toBe('csrf-token')
    expect(patches).toEqual([
      {
        data: {
          type: 'applicant-application-forms',
          id: APPLICATION_ID,
          attributes: {
            step: 'personal-details',
            version: 7,
            answers: {
              name: 'Ada King',
              dateOfBirth: '1815-12-10',
              country: 'United Kingdom',
              nationality: 'British',
              email: 'ada@example.com',
              phone: '',
              consentConfirmed: true,
            },
          },
        },
      },
    ])
    expect(await axe(container)).toHaveNoViolations()
  })

  it('hides the saved state as soon as an answer changes', async () => {
    serveForm()
    const { user } = renderStep('personal-details')

    await user.type(await nameField(), ' King')
    await user.click(saveButton())
    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    await user.type(await nameField(), '!')

    expect(savedNotice()).not.toBeInTheDocument()
  })

  it('sends the version returned by the previous save', async () => {
    const patches = serveForm()
    const { user } = renderStep('personal-details')

    await user.type(await nameField(), ' King')
    await user.click(saveButton())
    await screen.findByText('Your answers have been saved.')
    await user.type(await nameField(), '!')
    await user.click(saveButton())
    await screen.findByText('Your answers have been saved.')

    expect(
      patches.map(
        (body) =>
          (body as { data: { attributes: { version: number } } }).data
            .attributes.version,
      ),
    ).toEqual([7, 8])
  })

  it('continues to the next step only after saving, keeping the saved answers', async () => {
    const patches = serveForm()
    const { user } = renderStep('personal-details')

    await user.type(await nameField(), ' King')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('heading', { name: 'Identity and address' }),
    ).toBeInTheDocument()
    expect(patches).toHaveLength(1)
    expect(screen.getByLabelText('City (required)')).toHaveValue('London')
  })

  it('keeps the entered answers and lets the applicant retry after a failure', async () => {
    let attempts = 0
    serveForm({
      patch: () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json(formDocument(savedAnswers, { version: 8 }))
      },
    })
    const { user, container } = renderStep('personal-details')

    await user.type(await nameField(), ' King')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your answers. We could not connect to the service. Check your internet connection and try again. Your answers are still on this page.',
    )
    expect(savedNotice()).not.toBeInTheDocument()
    expect(await nameField()).toHaveValue('Ada Lovelace King')
    expect(await axe(container)).toHaveNoViolations()

    await user.click(saveButton())

    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not continue when saving fails', async () => {
    serveForm({ patch: () => new HttpResponse(null, { status: 500 }) })
    const { user } = renderStep('personal-details')

    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your answers.',
    )
    expect(
      screen.getByRole('heading', { name: 'Personal details' }),
    ).toBeInTheDocument()
  })

  it.each([
    [401, 'authentication-required'],
    [403, 'access-denied'],
  ])(
    'explains an ended session (%s) and links to sign in',
    async (status, code) => {
      serveForm({
        patch: () =>
          HttpResponse.json(errorDocument(status, code, 'Denied'), { status }),
      })
      const { user } = renderStep('personal-details')

      await user.type(await nameField(), ' King')
      await user.click(saveButton())

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Your session has ended, so your latest changes were not saved. Sign in again to continue.',
      )
      expect(
        screen.getByRole('link', { name: 'Sign in again' }),
      ).toHaveAttribute(
        'href',
        `/sign-in?returnTo=%2Fapplications%2F${APPLICATION_ID}%2Fpersonal-details`,
      )
      expect(await nameField()).toHaveValue('Ada Lovelace King')
    },
  )

  it('explains a version conflict and reloads the latest saved answers', async () => {
    serveForm({
      patch: () =>
        HttpResponse.json(
          errorDocument(
            409,
            'form-version-conflict',
            'Reload the form and try again.',
          ),
          { status: 409 },
        ),
    })
    const { user } = renderStep('personal-details')

    await user.type(await nameField(), ' King')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This application was changed somewhere else, so your latest changes were not saved.',
    )
    expect(await nameField()).toHaveValue('Ada Lovelace King')

    server.use(
      http.get(FORM_URL, () =>
        HttpResponse.json(
          formDocument(
            { ...savedAnswers, name: 'Augusta Ada King' },
            { version: 9 },
          ),
        ),
      ),
    )
    await user.click(
      screen.getByRole('button', { name: 'Reload saved answers' }),
    )

    expect(
      await screen.findByText('The latest saved answers have been loaded.'),
    ).toBeVisible()
    expect(await nameField()).toHaveValue('Augusta Ada King')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the API reason when answers are rejected', async () => {
    serveForm({
      patch: () =>
        HttpResponse.json(
          errorDocument(
            422,
            'unprocessable-form',
            'The submitted form could not be accepted.',
          ),
          { status: 422 },
        ),
    })
    const { user } = renderStep('personal-details')

    await user.type(await nameField(), ' King')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save these answers. The submitted form could not be accepted. Check your answers and try again.',
    )
  })
})
