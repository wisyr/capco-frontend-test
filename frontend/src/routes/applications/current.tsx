import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  applicationFormQuery,
  currentApplicationQuery,
  startApplication,
  type CurrentApplication,
} from '../../api/applicant-applications'
import { UnexpectedResponseError } from '../../api/json-api-client'
import { requestFailureMessage } from '../../api/request-failure-message'
import { isSafeJourneyPath } from '../../features/account-access/return-target'
import {
  ApplicantJourneyPresentation,
  type ApplicantJourneyProgressItem,
} from '../../features/applicant-journey/applicant-journey-presentation'
import {
  LoadFailedPage,
  LoadingPage,
} from '../../features/applicant-journey/page-status'
import {
  isSessionExpired,
  SessionExpiredRedirect,
} from '../../features/applicant-journey/session'

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
  // The draft's own progress never marks the last step complete, so the
  // form's step states, judged by the saved answers, are shown instead.
  const form = useQuery({
    ...applicationFormQuery(current.data?.id ?? ''),
    enabled: Boolean(current.data),
  })
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
  if (!application) {
    return (
      <>
        <title>{`${pageTitle} | KYC`}</title>
        <ApplicantJourneyPresentation
          actionError={startErrorMessage(start.error)}
          entryState="start"
          isActionPending={start.isPending}
          progress={notStartedProgress}
          onPrimaryAction={() => start.mutate()}
        />
      </>
    )
  }

  if (form.data === undefined) {
    if (isSessionExpired(form.error)) {
      return <SessionExpiredRedirect />
    }
    if (!form.isError) {
      return (
        <LoadingPage title={pageTitle} message="Loading your application…" />
      )
    }
  }
  // If the form cannot be loaded, the draft's own progress is still true,
  // just less complete.
  const progress =
    form.data?.steps ??
    application.progress.map(({ step, state }) => ({
      step,
      state: state === 'not-started' ? ('remaining' as const) : state,
    }))
  const readyForReview = progress.every(({ state }) => state === 'complete')
  return (
    <>
      <title>{`${pageTitle} | KYC`}</title>
      <ApplicantJourneyPresentation
        entryState={readyForReview ? 'review' : 'resume'}
        progress={progress}
        onPrimaryAction={() =>
          void navigate(
            readyForReview
              ? `/applications/${application.id}/review`
              : application.href,
          )
        }
      />
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
