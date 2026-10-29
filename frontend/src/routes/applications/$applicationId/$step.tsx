import { useQuery } from '@tanstack/react-query'
import { data } from 'react-router'

import { stepTitles } from '../-application-steps'
import {
  ApplicationNotFoundPage,
  LoadFailedPage,
  LoadingPage,
} from '../-page-status'
import { ReviewPage } from '../-review-page'
import { isSessionExpired, SessionExpiredRedirect } from '../-session'
import { StepForm } from '../-step-form'
import {
  applicationFormQuery,
  applicationSteps,
  type ApplicationStep,
} from '../../../api/applicant-applications'
import { ApiError } from '../../../api/json-api-client'
import { requestFailureMessage } from '../../../api/request-failure-message'

import type { Route } from './+types/$step'

function isApplicationStep(step: string): step is ApplicationStep {
  return (applicationSteps as readonly string[]).includes(step)
}

/** The step named in the URL; any other value is a missing page. */
export function parseStepParam(step: string): ApplicationStep | 'review' {
  if (step === 'review' || isApplicationStep(step)) {
    return step
  }
  throw data(null, { status: 404 })
}

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  return { step: parseStepParam(params.step) }
}

export default function ApplicationStepPage({
  params,
  loaderData,
}: Route.ComponentProps) {
  const { step } = loaderData
  if (step === 'review') {
    return <ReviewPage applicationId={params.applicationId} />
  }
  return <StepPage applicationId={params.applicationId} step={step} />
}

function StepPage({
  applicationId,
  step,
}: {
  applicationId: string
  step: ApplicationStep
}) {
  const form = useQuery(applicationFormQuery(applicationId))
  const title = stepTitles[step]

  if (form.isPending) {
    return <LoadingPage title={title} message="Loading your saved answers…" />
  }
  if (form.isError) {
    if (isSessionExpired(form.error)) {
      return <SessionExpiredRedirect />
    }
    if (form.error instanceof ApiError && form.error.status === 404) {
      return <ApplicationNotFoundPage />
    }
    return (
      <LoadFailedPage
        title={title}
        message={`We could not load your saved answers. ${requestFailureMessage(form.error)}`}
        onRetry={() => void form.refetch()}
      />
    )
  }
  return (
    <StepForm
      // A new step or application starts from its own saved answers.
      key={`${applicationId}/${step}`}
      applicationId={applicationId}
      form={form.data}
      step={step}
    />
  )
}
