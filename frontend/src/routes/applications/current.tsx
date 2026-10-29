import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { isSafeJourneyPath } from '../-return-target'
import {
  currentApplicationQuery,
  startApplication,
  type CurrentApplication,
} from '../../api/applicant-applications'
import { UnexpectedResponseError } from '../../api/json-api-client'
import { requestFailureMessage } from '../../api/request-failure-message'

import {
  ApplicantJourneyPresentation,
  type ApplicantJourneyProgressItem,
} from './-applicant-journey-presentation'
import { LoadFailedPage, LoadingPage } from './-page-status'
import { isSessionExpired, SessionExpiredRedirect } from './-session'

const pageTitle = 'Your KYC application'

/** Progress shown before a draft exists: the first step is next. */
const notStartedProgress: readonly ApplicantJourneyProgressItem[] = [
  { step: 'personal-details', state: 'current' },
  { step: 'identity-and-address', state: 'remaining' },
]

export default function CurrentApplicationJourneyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const current = useQuery(currentApplicationQuery)
  const start = useMutation({
    mutationFn: async () => assertSafeJourney(await startApplication()),
    onSuccess: (application) => {
      queryClient.setQueryData(currentApplicationQuery.queryKey, application)
      void navigate(application.href)
    },
  })

  if (isSessionExpired(start.error)) {
    return <SessionExpiredRedirect />
  }
  // Errors replace the page only before anything has loaded; a failed
  // background refetch keeps showing the application already on screen.
  if (current.data === undefined) {
    if (isSessionExpired(current.error)) {
      return <SessionExpiredRedirect />
    }
    if (current.isError) {
      return (
        <LoadFailedPage
          title={pageTitle}
          message={`We could not load your application. ${requestFailureMessage(current.error)}`}
          onRetry={() => void current.refetch()}
        />
      )
    }
    return <LoadingPage title={pageTitle} message="Loading your application…" />
  }

  const application = current.data
  if (application && !isSafeJourneyPath(application.href)) {
    return (
      <LoadFailedPage
        title={pageTitle}
        message="We could not open your application. Try again later."
        onRetry={() => void current.refetch()}
      />
    )
  }
  return (
    <>
      <title>{`${pageTitle} | KYC`}</title>
      {application ? (
        <ApplicantJourneyPresentation
          entryState="resume"
          progress={application.progress.map(({ step, state }) => ({
            step,
            state: state === 'not-started' ? 'remaining' : state,
          }))}
          onPrimaryAction={() => void navigate(application.href)}
        />
      ) : (
        <ApplicantJourneyPresentation
          actionError={startErrorMessage(start.error)}
          entryState="start"
          isActionPending={start.isPending}
          progress={notStartedProgress}
          onPrimaryAction={() => start.mutate()}
        />
      )}
    </>
  )
}

/** Only follow journey URLs that stay inside the applicant journey. */
function assertSafeJourney(application: CurrentApplication) {
  if (!isSafeJourneyPath(application.href)) {
    throw new UnexpectedResponseError(
      `Refusing to navigate to ${application.href}.`,
    )
  }
  return application
}

function startErrorMessage(error: Error | null): string | undefined {
  return error
    ? `We could not start your application. ${requestFailureMessage(error)}`
    : undefined
}
