import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

import {
  applicationFormQuery,
  applicationReviewQuery,
  applicationSteps,
  currentApplicationQuery,
  saveApplicationForm,
  uploadDocumentEvidence,
  type ApplicationForm,
  type ApplicationStep,
  type SaveFormRequest,
} from '../../api/applicant-applications'
import { ApiError } from '../../api/json-api-client'
import { requestFailureMessage } from '../../api/request-failure-message'
import { PendingStatus } from '../../shared/pending-status'
import { useFieldErrors } from '../../shared/use-field-errors'
import { accountAccessHref } from '../account-access/return-target'
import { isSessionExpired } from '../applicant-journey/session'
import { useUnsavedChangesGuard } from '../applicant-journey/unsaved-changes'

import styles from './application-step.module.css'
import {
  answersForStep,
  stepFields,
  stepTitles,
  valuesFromAnswers,
  type TextAnswerField,
} from './application-steps'
import { acceptedDocumentTypes, DocumentUploadError } from './document-evidence'
import {
  hasStepErrors,
  validateStep,
  type StepCompleteness,
  type StepField,
} from './step-validation'

export interface StepFormProps {
  applicationId: string
  step: ApplicationStep
  /** The saved form the fields start from. */
  form: ApplicationForm
}

/** Save keeps the applicant on the step; continue moves on after saving. */
type SaveIntent = 'save' | 'continue'

type Notice = { message: string; severity: 'success' | 'info' }

/**
 * Input ids in focus order. Both steps share the list; only the open step's
 * fields can have errors.
 */
const fieldIds = Object.fromEntries([
  ...stepFields['personal-details'].map(({ name }) => [name, `answer-${name}`]),
  ['consentConfirmed', 'answer-consentConfirmed'],
  ...stepFields['identity-and-address'].map(({ name }) => [
    name,
    `answer-${name}`,
  ]),
  ['document', 'document-evidence'],
]) as Record<StepField, string>
const documentInputId = fieldIds.document
const consentErrorId = `${fieldIds.consentConfirmed}-error`

export function StepForm({ applicationId, step, form }: StepFormProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const formQuery = applicationFormQuery(applicationId)
  const [values, setValues] = useState(() => valuesFromAnswers(form.answers))
  // What the API last confirmed for this step, to tell unsaved edits apart.
  const [savedAnswers, setSavedAnswers] = useState(() =>
    answersForStep(step, valuesFromAnswers(form.answers)),
  )
  // The version these answers are based on. Background refetches must not
  // advance it, or a save could overwrite changes made somewhere else.
  const [version, setVersion] = useState(form.version)
  const [notice, setNotice] = useState<Notice>()
  const [documentPresent, setDocumentPresent] = useState(
    form.documentEvidencePresent,
  )
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  // Remounts the file input to clear it once its file is uploaded.
  const [documentInputKey, setDocumentInputKey] = useState(0)
  const {
    fieldErrors,
    showFieldErrors,
    revalidateFieldErrors,
    clearFieldErrors,
  } = useFieldErrors(fieldIds)
  // How the last Save or Continue checked the step, so fixing a field
  // re-checks it by the same rules.
  const [checkedAs, setCheckedAs] = useState<StepCompleteness>('partial')

  const hasUnsavedChanges =
    documentFile !== null ||
    JSON.stringify(answersForStep(step, values)) !==
      JSON.stringify(savedAnswers)
  const reportUnsavedChanges = useUnsavedChangesGuard(hasUnsavedChanges)

  const stepNumber = applicationSteps.indexOf(step) + 1
  const title = stepTitles[step]
  const isFirstStep = step === 'personal-details'
  const previousHref = isFirstStep
    ? '/applications/current'
    : `/applications/${applicationId}/personal-details`
  const nextHref = isFirstStep
    ? `/applications/${applicationId}/identity-and-address`
    : `/applications/${applicationId}/review`

  /** Records what the API persisted so later saves and steps build on it. */
  function keepSaved(saved: ApplicationForm) {
    queryClient.setQueryData(formQuery.queryKey, saved)
    void queryClient.invalidateQueries({
      queryKey: currentApplicationQuery.queryKey,
    })
    // Dropped rather than refetched, so the review page never shows
    // readiness from before this save while it checks again.
    queryClient.removeQueries({
      queryKey: applicationReviewQuery(applicationId).queryKey,
    })
    setVersion(saved.version)
    setDocumentPresent(saved.documentEvidencePresent)
  }

  const save = useMutation({
    mutationFn: async ({
      file,
      ...request
    }: SaveFormRequest & { intent: SaveIntent; file: File | null }) => {
      const saved = await saveApplicationForm(applicationId, request)
      if (!file) {
        return saved
      }
      try {
        await uploadDocumentEvidence(applicationId, file)
      } catch (cause) {
        throw new DocumentUploadError(saved, cause)
      }
      return { ...saved, documentEvidencePresent: true }
    },
    onSuccess: (saved, { intent, file, answers }) => {
      keepSaved(saved)
      setSavedAnswers(answers)
      if (file) {
        setDocumentFile(null)
        setDocumentInputKey((key) => key + 1)
      }
      if (intent === 'continue') {
        reportUnsavedChanges(false)
        void navigate(nextHref)
      } else {
        setNotice({
          message: file
            ? 'Your answers and document have been saved.'
            : 'Your answers have been saved.',
          severity: 'success',
        })
      }
    },
    onError: (error, { answers }) => {
      if (error instanceof DocumentUploadError) {
        keepSaved(error.savedForm)
        setSavedAnswers(answers)
      }
    },
  })

  const reload = useMutation({
    mutationFn: () => queryClient.fetchQuery({ ...formQuery, staleTime: 0 }),
    onSuccess: (latest) => {
      const latestValues = valuesFromAnswers(latest.answers)
      setValues(latestValues)
      setSavedAnswers(answersForStep(step, latestValues))
      setVersion(latest.version)
      save.reset()
      clearFieldErrors()
      setNotice({
        message: 'The latest saved answers have been loaded.',
        severity: 'success',
      })
    },
  })

  function submit(intent: SaveIntent) {
    if (save.isPending || reload.isPending) {
      return
    }
    // Continue needs a complete step. Save keeps a half-finished draft, but
    // only with valid values.
    const completeness = intent === 'continue' ? 'complete' : 'partial'
    setCheckedAs(completeness)
    const errors = validateStep(
      step,
      values,
      { present: documentPresent, file: documentFile },
      completeness,
    )
    if (hasStepErrors(errors)) {
      setNotice(undefined)
      showFieldErrors(errors)
      return
    }
    clearFieldErrors()
    if (intent === 'save' && !hasUnsavedChanges) {
      setNotice({ message: 'There are no changes to save.', severity: 'info' })
      return
    }
    setNotice(undefined)
    save.mutate({
      step,
      answers: answersForStep(step, values),
      version,
      intent,
      file: documentFile,
    })
  }

  /** Re-checks fields already showing an error, by the last rules used. */
  function revalidate(nextValues: typeof values, nextFile: File | null) {
    revalidateFieldErrors(
      validateStep(
        step,
        nextValues,
        { present: documentPresent, file: nextFile },
        checkedAs,
      ),
    )
  }

  function edit(update: (current: typeof values) => typeof values) {
    const next = update(values)
    setValues(next)
    // Anything typed after a save is not saved yet.
    setNotice(undefined)
    revalidate(next, documentFile)
  }

  function setText(name: TextAnswerField, value: string) {
    edit((current) => ({
      ...current,
      text: { ...current.text, [name]: value },
    }))
  }

  const savingIntent = save.isPending ? save.variables.intent : undefined

  return (
    <main className={styles.page}>
      <title>{`${title} – Step ${stepNumber} of ${applicationSteps.length} | KYC`}</title>
      <Box component="div" className={styles.stepContent}>
        <Stack spacing={3}>
          <Typography component="p" variant="eyebrow" tone="accent">
            STEP {stepNumber} OF {applicationSteps.length}
          </Typography>
          <Typography component="h1" variant="heading">
            {title}
          </Typography>
          <Typography tone="muted">
            Save your answers at any time and come back to finish later.
          </Typography>
          <Stack
            component="form"
            className={styles.stepForm}
            onSubmit={(event) => {
              event.preventDefault()
              submit('continue')
            }}
            spacing={2}
          >
            {stepFields[step].map(
              ({ name, label, autoComplete, type, hint }) => (
                <TextField
                  autoComplete={autoComplete}
                  error={Boolean(fieldErrors[name])}
                  helperText={fieldErrors[name] ?? hint}
                  id={fieldIds[name]}
                  key={name}
                  label={`${label} (required)`}
                  name={name}
                  onChange={(event) => setText(name, event.target.value)}
                  required
                  type={type}
                  value={values.text[name]}
                />
              ),
            )}
            {isFirstStep ? (
              <div className={styles.checkboxField}>
                <label>
                  <input
                    aria-describedby={
                      fieldErrors.consentConfirmed ? consentErrorId : undefined
                    }
                    aria-invalid={
                      fieldErrors.consentConfirmed ? true : undefined
                    }
                    checked={values.consentConfirmed}
                    id={fieldIds.consentConfirmed}
                    name="consentConfirmed"
                    onChange={(event) => {
                      const { checked } = event.target
                      edit((current) => ({
                        ...current,
                        consentConfirmed: checked,
                      }))
                    }}
                    required
                    type="checkbox"
                  />{' '}
                  I confirm these details are accurate and belong to me.
                </label>
                {fieldErrors.consentConfirmed ? (
                  <Typography
                    className={styles.fieldError}
                    id={consentErrorId}
                    variant="caption"
                  >
                    {fieldErrors.consentConfirmed}
                  </Typography>
                ) : null}
              </div>
            ) : (
              <div className={styles.documentField}>
                <label htmlFor={documentInputId}>
                  Document evidence (required)
                </label>
                <Typography
                  id={`${documentInputId}-description`}
                  tone="muted"
                  variant="caption"
                >
                  {documentPresent
                    ? 'A document is already on file. Choose a new image only if you want to replace it.'
                    : 'Upload a JPG or PNG image of your identity document, up to 10 MB.'}
                </Typography>
                {fieldErrors.document ? (
                  <Typography
                    className={styles.fieldError}
                    id={`${documentInputId}-error`}
                    variant="caption"
                  >
                    {fieldErrors.document}
                  </Typography>
                ) : null}
                <input
                  accept={acceptedDocumentTypes.join(',')}
                  aria-describedby={[
                    `${documentInputId}-description`,
                    fieldErrors.document && `${documentInputId}-error`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-invalid={fieldErrors.document ? true : undefined}
                  id={documentInputId}
                  key={documentInputKey}
                  name="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setDocumentFile(file)
                    setNotice(undefined)
                    revalidate(values, file)
                  }}
                  required={!documentPresent}
                  type="file"
                />
              </div>
            )}
            {save.isError ? (
              <Alert severity="error">
                {saveErrorMessage(save.error, {
                  signInHref: accountAccessHref('/sign-in', pathname),
                  reloadAction: (
                    <Button
                      isPending={reload.isPending}
                      onPress={() => reload.mutate()}
                      variant="secondary"
                    >
                      Reload saved answers
                    </Button>
                  ),
                })}
                {reload.isError ? (
                  <> {requestFailureMessage(reload.error)}</>
                ) : null}
              </Alert>
            ) : null}
            {/* Always mounted so screen readers announce new notices. */}
            <div role="status">
              {notice ? (
                <Alert role="none" severity={notice.severity}>
                  {notice.message}
                </Alert>
              ) : null}
            </div>
            <PendingStatus
              message={savingIntent ? 'Saving your answers…' : undefined}
            />
            <Stack
              component="div"
              className={styles.formActions}
              direction="row"
              spacing={2}
            >
              <Button
                type="button"
                variant="quiet"
                onPress={() => void navigate(previousHref)}
              >
                Back
              </Button>
              <Stack component="div" direction="row" spacing={2}>
                <Button
                  isDisabled={savingIntent === 'continue'}
                  isPending={savingIntent === 'save'}
                  onPress={() => submit('save')}
                  type="button"
                  variant="secondary"
                >
                  Save
                </Button>
                <Button
                  isDisabled={savingIntent === 'save'}
                  isPending={savingIntent === 'continue'}
                  type="submit"
                >
                  {isFirstStep ? 'Continue' : 'Save and review'}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </main>
  )
}

/** Why a save failed and what the applicant can do; entered values stay. */
function saveErrorMessage(
  error: Error,
  actions: { signInHref: string; reloadAction: ReactNode },
): ReactNode {
  if (error instanceof DocumentUploadError) {
    return (
      <>
        Your answers were saved, but your document was not uploaded.{' '}
        {documentUploadReason(error.cause, actions.signInHref)}
      </>
    )
  }
  if (
    isSessionExpired(error) ||
    (error instanceof ApiError && error.status === 403)
  ) {
    return (
      <>
        Your session has ended, so your latest changes were not saved.{' '}
        <Link href={actions.signInHref}>Sign in again</Link> to continue.
      </>
    )
  }
  if (error instanceof ApiError && error.hasCode('form-version-conflict')) {
    return (
      <>
        This application was changed somewhere else, so your latest changes were
        not saved. Reloading shows the latest saved answers and replaces what
        you entered on this step.
        <span className={styles.alertAction}>{actions.reloadAction}</span>
      </>
    )
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        This application is no longer available, so your latest changes were not
        saved. <Link href="/applications/current">Go to your application</Link>
      </>
    )
  }
  if (
    error instanceof ApiError &&
    (error.status === 400 || error.status === 422)
  ) {
    const detail = error.errors[0]?.detail
    return [
      'We could not save these answers.',
      detail,
      'Check your answers and try again.',
    ]
      .filter(Boolean)
      .join(' ')
  }
  return `We could not save your answers. ${requestFailureMessage(error)} Your answers are still on this page.`
}

function documentUploadReason(cause: unknown, signInHref: string): ReactNode {
  if (
    isSessionExpired(cause) ||
    (cause instanceof ApiError && cause.status === 403)
  ) {
    return (
      <>
        Your session has ended. <Link href={signInHref}>Sign in again</Link> to
        upload it.
      </>
    )
  }
  if (cause instanceof ApiError && cause.status === 422) {
    return `${cause.errors[0]?.detail ?? 'The image was not accepted.'} Choose a JPG or PNG image up to 10 MB and save again.`
  }
  return `${requestFailureMessage(cause)} Choose Save to try again.`
}
