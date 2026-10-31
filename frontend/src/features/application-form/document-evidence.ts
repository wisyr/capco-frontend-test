import type { ApplicationForm } from '../../api/applicant-applications'

/** Upload limits from the document-evidence endpoint in the API contract. */
export const acceptedDocumentTypes = ['image/jpeg', 'image/png'] as const
const maxDocumentBytes = 10 * 1024 * 1024

/** Why the API would reject this file, checked before uploading it. */
export function documentFileError(file: File): string | undefined {
  if (!(acceptedDocumentTypes as readonly string[]).includes(file.type)) {
    return 'Choose a JPG or PNG image.'
  }
  if (file.size === 0) {
    return 'The selected file is empty. Choose another image.'
  }
  if (file.size > maxDocumentBytes) {
    return 'Choose an image that is 10 MB or smaller.'
  }
  return undefined
}

/** The answers were saved, but uploading the document afterwards failed. */
export class DocumentUploadError extends Error {
  override readonly name = 'DocumentUploadError'
  readonly savedForm: ApplicationForm

  constructor(savedForm: ApplicationForm, cause: unknown) {
    super('The document could not be uploaded.', { cause })
    this.savedForm = savedForm
  }
}

/**
 * The form to keep after a save and an upload. The form read after the upload
 * is used only if the upload was the one change since the save. Otherwise
 * (another tab saved meanwhile, or the read failed) the save's version stays,
 * so the next save reports a conflict instead of overwriting anything.
 */
export function afterUpload(
  saved: ApplicationForm,
  latest: ApplicationForm | undefined,
): ApplicationForm {
  const onlyThisUpload =
    latest?.version !== undefined &&
    saved.version !== undefined &&
    latest.version === saved.version + 1
  return onlyThisUpload && latest
    ? latest
    : { ...saved, documentEvidencePresent: true }
}
