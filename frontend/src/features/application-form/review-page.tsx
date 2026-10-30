import {
  Alert,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@kyc/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  applicationSteps,
  type ApplicationReview,
} from '../../api/applicant-applications'
import { useFieldErrors } from '../../shared/use-field-errors'

import styles from './application-step.module.css'
import { fieldLabel, stepTitles } from './application-steps'

const confirmationId = 'review-confirmation'
const confirmationErrorId = `${confirmationId}-error`
const confirmationRequired =
  'Confirm that the information is complete and accurate.'

/**
 * Prototype review step. Submitting is outside the save-and-resume scope, so
 * Submit only opens the receipt. It is offered only once the API reports the
 * draft as ready, and it still needs the confirmation.
 */
export function ReviewPage({
  applicationId,
  review,
}: {
  applicationId: string
  review: ApplicationReview
}) {
  return (
    <main className={styles.reviewPage}>
      <title>Review application | KYC</title>
      <Card className={styles.reviewCard}>
        <CardContent>
          {review.ready ? (
            <ReadyToSubmit applicationId={applicationId} />
          ) : (
            <MissingAnswers applicationId={applicationId} review={review} />
          )}
        </CardContent>
      </Card>
    </main>
  )
}

/** Lists what the API still needs, grouped by step, with a link to each. */
function MissingAnswers({
  applicationId,
  review,
}: {
  applicationId: string
  review: ApplicationReview
}) {
  const steps = applicationSteps
    .map((step) => ({
      step,
      fields: review.missingRequiredFields
        .filter((missing) => missing.step === step)
        .map(({ field }) => fieldLabel(step, field)),
    }))
    .filter(({ fields }) => fields.length > 0)

  return (
    <Stack spacing={2}>
      <Typography component="h1" variant="heading">
        Review application
      </Typography>
      <Alert severity="info">
        Your application is not ready to submit yet. Complete these answers
        first.
      </Alert>
      {steps.map(({ step, fields }) => {
        const headingId = `missing-${step}`
        return (
          <section aria-labelledby={headingId} key={step}>
            <Typography component="h2" id={headingId} variant="subheading">
              {stepTitles[step]}
            </Typography>
            <ul className={styles.missingList}>
              {fields.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <Link href={`/applications/${applicationId}/${step}`}>
              {`Complete ${stepTitles[step].toLowerCase()}`}
            </Link>
          </section>
        )
      })}
    </Stack>
  )
}

function ReadyToSubmit({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const { fieldErrors, showFieldErrors, revalidateFieldErrors } =
    useFieldErrors({ confirmation: confirmationId })

  return (
    <Stack
      component="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!confirmed) {
          showFieldErrors({ confirmation: confirmationRequired })
          return
        }
        void navigate(`/applications/${applicationId}/submitted`)
      }}
      spacing={2}
    >
      <Typography component="h1" variant="heading">
        Review application
      </Typography>
      <Typography>
        All required answers are saved. Confirm them to submit your application.
      </Typography>
      <div className={styles.checkboxField}>
        <label>
          <input
            aria-describedby={
              fieldErrors.confirmation ? confirmationErrorId : undefined
            }
            aria-invalid={fieldErrors.confirmation ? true : undefined}
            checked={confirmed}
            id={confirmationId}
            name="confirmation"
            onChange={(event) => {
              const { checked } = event.target
              setConfirmed(checked)
              revalidateFieldErrors({
                confirmation: checked ? undefined : confirmationRequired,
              })
            }}
            required
            type="checkbox"
          />{' '}
          I confirm the information is complete and accurate.
        </label>
        {fieldErrors.confirmation ? (
          <Typography
            className={styles.fieldError}
            id={confirmationErrorId}
            variant="caption"
          >
            {fieldErrors.confirmation}
          </Typography>
        ) : null}
      </div>
      <Button type="submit">Submit</Button>
      <Button
        onPress={() =>
          void navigate(`/applications/${applicationId}/identity-and-address`)
        }
        type="button"
        variant="secondary"
      >
        Return to form
      </Button>
    </Stack>
  )
}
