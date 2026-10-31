import {
  Alert,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@kyc/ui'

import styles from './applicant-journey.module.css'

/** Placeholder page shown while journey data loads. */
export function LoadingPage({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <main className={styles.page}>
      <title>{`${title} | KYC`}</title>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Typography role="status">{message}</Typography>
        </CardContent>
      </Card>
    </main>
  )
}

/** Page shown when journey data could not be loaded, with a retry action. */
export function LoadFailedPage({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <main className={styles.page}>
      <title>{`${title} | KYC`}</title>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Stack spacing={3}>
            <Typography component="h1" variant="heading">
              {title}
            </Typography>
            <Alert severity="error">{message}</Alert>
            <Button onPress={onRetry} variant="secondary">
              Try again
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}

/** Page shown when the application is missing or belongs to someone else. */
export function ApplicationNotFoundPage() {
  return (
    <main className={styles.page}>
      <title>Application not found | KYC</title>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Stack spacing={3}>
            <Typography component="h1" variant="heading">
              Application not found
            </Typography>
            <Typography>
              This application is not available. It may have been submitted, or
              the link may be wrong.
            </Typography>
            <Link href="/applications/current">Go to your application</Link>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
