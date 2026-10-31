import { fireEvent, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
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

const EVIDENCE_URL = `/api/v1/applicant-applications/${APPLICATION_ID}/document-evidence`

const documentInput = () =>
  screen.findByLabelText('Document evidence (required)')
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const png = () => new File(['png-bytes'], 'passport.png', { type: 'image/png' })

function evidenceStored() {
  return HttpResponse.json(
    {
      data: {
        type: 'applicant-application-document-evidence',
        id: APPLICATION_ID,
        attributes: { present: true },
      },
    },
    { status: 201 },
  )
}

/**
 * Serves the form like the API does: a save and a stored document each
 * advance the version, and a save with any other version is a conflict.
 * Records the order of PATCH and upload requests.
 */
function serveForm({
  documentPresent = false,
  upload = evidenceStored,
}: {
  documentPresent?: boolean
  upload?: () => Response
} = {}) {
  const requests: string[] = []
  const stored = { version: 7, documentPresent }
  const current = () =>
    HttpResponse.json(
      formDocument(savedAnswers, {
        version: stored.version,
        documentPresent: stored.documentPresent,
      }),
    )
  server.use(
    http.get(FORM_URL, current),
    http.patch(FORM_URL, async ({ request }) => {
      const body = (await request.json()) as {
        data: { attributes: { version: number } }
      }
      const { version } = body.data.attributes
      requests.push(`PATCH v${version}`)
      if (version !== stored.version) {
        return HttpResponse.json(
          {
            errors: [
              {
                status: '409',
                code: 'form-version-conflict',
                title: 'Form version conflict',
                detail: 'Reload the form and try again.',
              },
            ],
          },
          { status: 409 },
        )
      }
      stored.version += 1
      return current()
    }),
    http.post(EVIDENCE_URL, async ({ request }) => {
      const file = (await request.formData()).get('file') as File
      requests.push(`UPLOAD ${file.name}`)
      const response = upload()
      if (response.ok) {
        stored.version += 1
        stored.documentPresent = true
      }
      return response
    }),
  )
  return { requests, stored }
}

describe('ApplicationStepPage document evidence', () => {
  it('says when a document is already on file', async () => {
    serveForm({ documentPresent: true })
    renderStep('identity-and-address')

    expect(await documentInput()).toHaveAccessibleDescription(
      'A document is already on file. Choose a new image only if you want to replace it.',
    )
    expect(await documentInput()).not.toBeRequired()
  })

  it('saves the answers, then uploads the chosen image', async () => {
    const { requests } = serveForm()
    const { user, container } = renderStep('identity-and-address')

    expect(await documentInput()).toHaveAccessibleDescription(
      'Upload a JPG or PNG image of your identity document, up to 10 MB.',
    )
    await user.upload(await documentInput(), png())
    await user.click(saveButton())

    expect(
      await screen.findByText('Your answers and document have been saved.'),
    ).toBeVisible()
    expect(requests).toEqual(['PATCH v7', 'UPLOAD passport.png'])
    expect(await documentInput()).toHaveAccessibleDescription(
      /A document is already on file/,
    )
    expect(((await documentInput()) as HTMLInputElement).files).toHaveLength(0)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('does not upload again when nothing new was chosen', async () => {
    const { requests } = serveForm()
    const { user } = renderStep('identity-and-address')

    await user.type(
      await screen.findByLabelText('City (required)'),
      ' Westminster',
    )
    await user.click(saveButton())

    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    expect(requests).toEqual(['PATCH v7'])
  })

  it('rejects a file the API would not accept before uploading', async () => {
    const { requests } = serveForm()
    renderStep('identity-and-address')

    fireEvent.change(await documentInput(), {
      target: {
        files: [new File(['%PDF'], 'id.pdf', { type: 'application/pdf' })],
      },
    })
    fireEvent.click(saveButton())

    expect(await documentInput()).toHaveFocus()
    expect(await documentInput()).toHaveAttribute('aria-invalid', 'true')
    expect(await documentInput()).toHaveAccessibleDescription(
      /Choose a JPG or PNG image\.$/,
    )
    expect(requests).toEqual([])
  })

  it('keeps the saved answers when the upload is rejected and retries with the new version', async () => {
    let uploads = 0
    const { requests } = serveForm({
      upload: () => {
        uploads += 1
        return uploads === 1
          ? HttpResponse.json(
              {
                errors: [
                  {
                    status: '422',
                    code: 'unprocessable-form',
                    title: 'Form could not be saved',
                    detail: 'Document size is not accepted.',
                  },
                ],
              },
              { status: 422 },
            )
          : evidenceStored()
      },
    })
    const { user } = renderStep('identity-and-address')

    await user.upload(await documentInput(), png())
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your answers were saved, but your document was not uploaded. Document size is not accepted. Choose a JPG or PNG image up to 10 MB and save again.',
    )
    expect(screen.queryByText(/have been saved/)).not.toBeInTheDocument()

    await user.click(saveButton())

    expect(
      await screen.findByText('Your answers and document have been saved.'),
    ).toBeVisible()
    expect(requests).toEqual([
      'PATCH v7',
      'UPLOAD passport.png',
      'PATCH v8',
      'UPLOAD passport.png',
    ])
  })

  it('saves again after an upload with the version the upload left', async () => {
    const { requests } = serveForm()
    const { user } = renderStep('identity-and-address')

    await user.upload(await documentInput(), png())
    await user.click(saveButton())
    expect(
      await screen.findByText('Your answers and document have been saved.'),
    ).toBeVisible()

    await user.type(
      await screen.findByLabelText('City (required)'),
      ' Westminster',
    )
    await user.click(saveButton())

    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // v8 after the save, v9 after the upload.
    expect(requests).toEqual(['PATCH v7', 'UPLOAD passport.png', 'PATCH v9'])
  })

  it('learns about a document stored elsewhere when reloading after a conflict', async () => {
    const { stored } = serveForm()
    const { user } = renderStep('identity-and-address')
    const city = await screen.findByLabelText('City (required)')

    // Another tab uploads a document, which advances the version.
    stored.version += 1
    stored.documentPresent = true
    await user.type(city, ' Westminster')
    await user.click(saveButton())
    await user.click(
      await screen.findByRole('button', { name: 'Reload saved answers' }),
    )

    expect(
      await screen.findByText('The latest saved answers have been loaded.'),
    ).toBeVisible()
    expect(await documentInput()).toHaveAccessibleDescription(
      /A document is already on file/,
    )
    expect(await documentInput()).not.toBeRequired()
  })

  it('opens the review without saving when nothing changed', async () => {
    const { requests } = serveForm({ documentPresent: true })
    server.use(http.get(REVIEW_URL, () => HttpResponse.json(reviewDocument())))
    const { user } = renderStep('identity-and-address')

    await user.click(
      await screen.findByRole('button', { name: 'Save and review' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Review application' }),
    ).toBeInTheDocument()
    expect(requests).toEqual([])
  })
})
