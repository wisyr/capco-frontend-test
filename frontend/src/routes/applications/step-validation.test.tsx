import { screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  FORM_URL,
  formDocument,
  renderStep,
  savedAnswers,
} from './step-test-utils'

expect.extend(toHaveNoViolations)

const field = (label: string) => screen.findByLabelText(`${label} (required)`)

/** Serves a form with these answers and records every PATCH. */
function serveForm(answers: object = savedAnswers) {
  const patches: unknown[] = []
  server.use(
    http.get(FORM_URL, () => HttpResponse.json(formDocument(answers))),
    http.patch(FORM_URL, async ({ request }) => {
      patches.push(await request.json())
      return HttpResponse.json(formDocument(answers, { version: 8 }))
    }),
  )
  return patches
}

describe('ApplicationStepPage validation', () => {
  it('explains every missing answer before continuing and sends nothing', async () => {
    const patches = serveForm({})
    const { user, container } = renderStep('personal-details')

    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(await field('Name')).toHaveFocus()
    expect(await field('Name')).toHaveAccessibleDescription('Enter your name.')
    expect(await field('Email')).toHaveAccessibleDescription(
      'Enter your email address.',
    )
    expect(
      screen.getByRole('checkbox', { name: /I confirm these details/ }),
    ).toHaveAccessibleDescription(
      'Confirm that these details are accurate and belong to you.',
    )
    expect(
      screen.getByRole('checkbox', { name: /I confirm these details/ }),
    ).toBeInvalid()
    expect(patches).toEqual([])
    expect(await axe(container)).toHaveNoViolations()
  })

  it('clears an error as soon as the answer is fixed', async () => {
    serveForm({})
    const { user } = renderStep('personal-details')

    await user.click(await screen.findByRole('button', { name: 'Continue' }))
    await user.type(await field('Name'), 'Ada Lovelace')

    expect(await field('Name')).not.toHaveAttribute('aria-invalid')
    expect(await field('Country')).toBeInvalid()
  })

  it('saves a half-finished draft', async () => {
    const patches = serveForm({})
    const { user } = renderStep('personal-details')

    await user.type(await field('Name'), 'Ada Lovelace')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    expect(patches).toHaveLength(1)
  })

  it('does not save an answer in the wrong format', async () => {
    const patches = serveForm({})
    const { user } = renderStep('personal-details')

    await user.type(await field('Email'), 'ada@example')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await field('Email')).toHaveFocus()
    expect(await field('Email')).toHaveAccessibleDescription(
      'Enter an email address in the format name@example.com.',
    )
    expect(patches).toEqual([])
  })

  it('says there is nothing to save when nothing changed', async () => {
    const patches = serveForm()
    const { user } = renderStep('personal-details')

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    const message = await screen.findByText('There are no changes to save.')
    // Inside the status region, so screen readers announce it.
    expect(message.closest('[role="status"]')).not.toBeNull()
    expect(patches).toEqual([])
  })

  it('asks for the document and a valid expiry before review', async () => {
    const patches = serveForm({ ...savedAnswers, expiry: '2000-01-01' })
    const { user } = renderStep('identity-and-address')

    await user.click(
      await screen.findByRole('button', { name: 'Save and review' }),
    )

    expect(await field('Expiry')).toHaveFocus()
    expect(await field('Expiry')).toHaveAccessibleDescription(
      'This document has expired. Use a document that is still valid.',
    )
    expect(
      await screen.findByLabelText('Document evidence (required)'),
    ).toHaveAccessibleDescription(
      /Choose an image of your identity document\.$/,
    )
    expect(patches).toEqual([])
  })
})
