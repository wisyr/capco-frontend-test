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
  savedAnswers,
} from './-step-test-utils'

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

/** Serves the form and records the order of PATCH and upload requests. */
function serveForm({
  documentPresent = false,
  upload = evidenceStored,
}: {
  documentPresent?: boolean
  upload?: () => Response
} = {}) {
  const requests: string[] = []
  let version = 7
  server.use(
    http.get(FORM_URL, () =>
      HttpResponse.json(formDocument(savedAnswers, { documentPresent })),
    ),
    http.patch(FORM_URL, async ({ request }) => {
      const body = (await request.json()) as {
        data: { attributes: { version: number } }
      }
      requests.push(`PATCH v${body.data.attributes.version}`)
      version += 1
      return HttpResponse.json(formDocument(savedAnswers, { version }))
    }),
    http.post(EVIDENCE_URL, async ({ request }) => {
      const file = (await request.formData()).get('file') as File
      requests.push(`UPLOAD ${file.name}`)
      return upload()
    }),
  )
  return requests
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
    const requests = serveForm()
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
    const requests = serveForm()
    const { user } = renderStep('identity-and-address')

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeVisible()
    expect(requests).toEqual(['PATCH v7'])
  })

  it('rejects a file the API would not accept before uploading', async () => {
    const requests = serveForm()
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
    const requests = serveForm({
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
})
