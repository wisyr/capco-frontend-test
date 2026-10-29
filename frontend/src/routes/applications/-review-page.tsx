import { Button, Card, CardContent, Stack, Typography } from '@kyc/ui'
import { useNavigate } from 'react-router'

import styles from '../application-step.module.css'

/** Prototype review step; submission is outside the save-and-resume scope. */
export function ReviewPage({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate()
  return (
    <main className={styles.reviewPage}>
      <Card className={styles.reviewCard}>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h1" variant="heading">
              Review application
            </Typography>
            <Typography>Your application is ready for review.</Typography>
            <label>
              <input type="checkbox" /> I confirm the information is complete
              and accurate.
            </label>
            <Button
              onClick={() =>
                void navigate(`/applications/${applicationId}/submitted`)
              }
            >
              Submit
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigate(
                  `/applications/${applicationId}/identity-and-address`,
                )
              }
            >
              Return to form
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
