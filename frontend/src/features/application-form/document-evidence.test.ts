import { describe, expect, it } from 'vitest'

import { afterUpload } from './document-evidence'

import type { ApplicationForm } from '../../api/applicant-applications'

const saved: ApplicationForm = {
  applicationId: 'application-1',
  answers: { city: 'London' },
  steps: [
    { step: 'personal-details', state: 'complete' },
    { step: 'identity-and-address', state: 'current' },
  ],
  documentEvidencePresent: false,
  version: 8,
}

describe('afterUpload', () => {
  it('keeps the form read after the upload when the upload was the only change', () => {
    const latest = { ...saved, documentEvidencePresent: true, version: 9 }

    expect(afterUpload(saved, latest)).toBe(latest)
  })

  it('keeps the save version when something else changed the form too', () => {
    const latest = {
      ...saved,
      answers: { city: 'Paris' },
      documentEvidencePresent: true,
      version: 10,
    }

    expect(afterUpload(saved, latest)).toEqual({
      ...saved,
      documentEvidencePresent: true,
    })
  })

  it('keeps the save version when the form could not be read again', () => {
    expect(afterUpload(saved, undefined)).toEqual({
      ...saved,
      documentEvidencePresent: true,
    })
  })
})
