import { Button, Card, CardContent, Stack, Typography } from '@kyc/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useFieldErrors } from '../-use-field-errors'
import styles from '../application-step.module.css'

const confirmationId = 'review-confirmation'
const confirmationErrorId = `${confirmationId}-error`
const confirmationRequired =
  'Confirm that the information is complete and accurate.'

/**
 * Prototype review step. Submitting is outside the save-and-resume scope, so
 * Submit only opens the receipt, but it still needs the confirmation.
 */
export function ReviewPage({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const { fieldErrors, showFieldErrors, revalidateFieldErrors } =
    useFieldErrors({ confirmation: confirmationId })

  return (
    <main className={styles.reviewPage}>
      <title>Review application | KYC</title>
      <Card className={styles.reviewCard}>
        <CardContent>
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
            <Typography>Your application is ready for review.</Typography>
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
                void navigate(
                  `/applications/${applicationId}/identity-and-address`,
                )
              }
              type="button"
              variant="secondary"
            >
              Return to form
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
