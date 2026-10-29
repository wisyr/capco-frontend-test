import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { PendingStatus } from '../-pending-status'
import { accountAccessHref } from '../-return-target'
import {
  applicationFormQuery,
  applicationSteps,
  currentApplicationQuery,
  saveApplicationForm,
  type ApplicationForm,
  type ApplicationStep,
  type SaveFormRequest,
} from '../../api/applicant-applications'
import { ApiError } from '../../api/json-api-client'
import { requestFailureMessage } from '../../api/request-failure-message'
import styles from '../application-step.module.css'

import {
  answersForStep,
  stepFields,
  stepTitles,
  valuesFromAnswers,
  type TextAnswerField,
} from './-application-steps'
import { isSessionExpired } from './-session'

export interface StepFormProps {
  applicationId: string
  step: ApplicationStep
  /** The saved form the fields start from. */
  form: ApplicationForm
}

/** Save keeps the applicant on the step; continue moves on after saving. */
type SaveIntent = 'save' | 'continue'

export function StepForm({ applicationId, step, form }: StepFormProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const formQuery = applicationFormQuery(applicationId)
  const [values, setValues] = useState(() => valuesFromAnswers(form.answers))
  // The version these answers are based on. Background refetches must not
  // advance it, or a save could overwrite changes made somewhere else.
  const [version, setVersion] = useState(form.version)
  const [notice, setNotice] = useState<string>()

  const stepNumber = applicationSteps.indexOf(step) + 1
  const title = stepTitles[step]
  const isFirstStep = step === 'personal-details'
  const previousHref = isFirstStep
    ? '/applications/current'
    : `/applications/${applicationId}/personal-details`
  const nextHref = isFirstStep
    ? `/applications/${applicationId}/identity-and-address`
    : `/applications/${applicationId}/review`

  const save = useMutation({
    mutationFn: (request: SaveFormRequest & { intent: SaveIntent }) =>
      saveApplicationForm(applicationId, request),
    onSuccess: (saved, { intent }) => {
      queryClient.setQueryData(formQuery.queryKey, saved)
      void queryClient.invalidateQueries({
        queryKey: currentApplicationQuery.queryKey,
      })
      setVersion(saved.version)
      if (intent === 'continue') {
        void navigate(nextHref)
      } else {
        setNotice('Your answers have been saved.')
      }
    },
  })

  const reload = useMutation({
    mutationFn: () => queryClient.fetchQuery({ ...formQuery, staleTime: 0 }),
    onSuccess: (latest) => {
      setValues(valuesFromAnswers(latest.answers))
      setVersion(latest.version)
      save.reset()
      setNotice('The latest saved answers have been loaded.')
    },
  })

  function submit(intent: SaveIntent) {
    if (save.isPending || reload.isPending) {
      return
    }
    setNotice(undefined)
    save.mutate({
      step,
      answers: answersForStep(step, values),
      version,
      intent,
    })
  }

  function edit(update: (current: typeof values) => typeof values) {
    setValues(update)
    // Anything typed after a save is not saved yet.
    setNotice(undefined)
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
            {stepFields[step].map(({ name, label, autoComplete, type }) => (
              <TextField
                autoComplete={autoComplete}
                id={`answer-${name}`}
                key={name}
                label={`${label} (required)`}
                name={name}
                onChange={(event) => setText(name, event.target.value)}
                required
                type={type}
                value={values.text[name]}
              />
            ))}
            {isFirstStep ? (
              <label>
                <input
                  checked={values.consentConfirmed}
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
            ) : (
              <>
                <label htmlFor="document-evidence">
                  Document evidence (required)
                </label>
                <input
                  id="document-evidence"
                  type="file"
                  accept="image/jpeg,image/png"
                />
              </>
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
                <Alert role="none" severity="success">
                  {notice}
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
