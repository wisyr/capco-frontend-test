import { Alert, Button, Link, Stack, TextField, Typography } from '@kyc/ui'
import { useMutation } from '@tanstack/react-query'
import { useState, type ChangeEvent, type ReactNode } from 'react'

import { createApplicantAccount } from '../api/applicant-accounts'
import { ApiError } from '../api/json-api-client'
import { requestFailureMessage } from '../api/request-failure-message'

import { AccountAccessCard } from './-account-access-card'
import { credentialFieldErrors } from './-credential-field-errors'
import {
  passwordPolicy,
  validateRegistration,
  type RegistrationField,
  type RegistrationValues,
} from './-registration-validation'
import { accountAccessHref } from './-return-target'
import { useFieldErrors } from './-use-field-errors'
import styles from './account-access.module.css'

export interface CreateAccountFormProps {
  returnTo?: string
}

const emptyValues: RegistrationValues = {
  email: '',
  password: '',
  passwordConfirmation: '',
}

/** Input ids, in the order focus moves to the first invalid field. */
const fieldIds: Record<RegistrationField, string> = {
  email: 'applicant-email',
  password: 'applicant-password',
  passwordConfirmation: 'applicant-password-confirmation',
}

export function CreateAccountForm({ returnTo }: CreateAccountFormProps) {
  const signInHref = accountAccessHref('/sign-in', returnTo)
  const [values, setValues] = useState(emptyValues)
  const { fieldErrors, showFieldErrors, clearFieldError, clearFieldErrors } =
    useFieldErrors(fieldIds)
  const registration = useMutation({
    mutationFn: createApplicantAccount,
    onSuccess: () => setValues(emptyValues),
    onError: (error) => {
      const apiFieldErrors = credentialFieldErrors(error)
      if (apiFieldErrors) {
        showFieldErrors(apiFieldErrors)
      }
    },
  })

  function submit() {
    if (registration.isPending) {
      return
    }
    const result = validateRegistration(values)
    if (!result.success) {
      showFieldErrors(result.errors)
      return
    }
    clearFieldErrors()
    registration.mutate(result.credentials)
  }

  function fieldProps(field: RegistrationField) {
    return {
      error: Boolean(fieldErrors[field]),
      fullWidth: true,
      id: fieldIds[field],
      name: field,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target
        setValues((current) => ({ ...current, [field]: value }))
        clearFieldError(field)
      },
      required: true,
      value: values[field],
    }
  }

  if (registration.isSuccess) {
    return (
      <AccountAccessCard>
        <title>Account created | KYC</title>
        <div className={styles.focusTarget} ref={focusOnMount} tabIndex={-1}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography component="h1" variant="heading">
                Account created
              </Typography>
              <Typography tone="muted">
                Your account for {registration.variables.email} is ready. Sign
                in to start your KYC application.
              </Typography>
            </Stack>
            <Link href={signInHref}>Sign in</Link>
          </Stack>
        </div>
      </AccountAccessCard>
    )
  }

  const formError = registration.isError
    ? registrationFormError(registration.error, signInHref)
    : undefined

  return (
    <AccountAccessCard>
      <title>Create your account | KYC</title>
      <Stack
        component="form"
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        spacing={3}
      >
        <Stack spacing={1}>
          <Typography component="h1" variant="heading">
            Create your account
          </Typography>
          <Typography tone="muted">
            Create credentials to begin your KYC application.
          </Typography>
        </Stack>
        {formError ? <Alert severity="error">{formError}</Alert> : null}
        <TextField
          {...fieldProps('email')}
          autoComplete="email"
          helperText={fieldErrors.email}
          label="Email address"
          spellCheck={false}
          type="email"
        />
        <TextField
          {...fieldProps('password')}
          autoComplete="new-password"
          helperText={fieldErrors.password ?? passwordPolicy}
          label="Password"
          type="password"
        />
        <TextField
          {...fieldProps('passwordConfirmation')}
          autoComplete="new-password"
          helperText={fieldErrors.passwordConfirmation}
          label="Confirm password"
          type="password"
        />
        <Button
          className={styles.submit}
          fullWidth
          isPending={registration.isPending}
          size="large"
          type="submit"
        >
          {registration.isPending ? 'Creating account…' : 'Create account'}
        </Button>
        <Typography className={styles.footer} align="center" variant="caption">
          <span>Already have an account? </span>
          <Link href={signInHref}>Sign in</Link>
        </Typography>
      </Stack>
    </AccountAccessCard>
  )
}

function focusOnMount(element: HTMLElement | null) {
  element?.focus()
}

/** Form-level feedback for failures that are not shown beside a field. */
function registrationFormError(
  error: Error,
  signInHref: string,
): ReactNode | undefined {
  if (credentialFieldErrors(error)) {
    return undefined
  }
  if (error instanceof ApiError && error.hasCode('email-already-registered')) {
    return (
      <>
        An account already exists for this email address.{' '}
        <Link href={signInHref}>Sign in</Link> or use a different email address.
      </>
    )
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'We could not process your details. Check them and try again.'
  }
  return requestFailureMessage(error)
}
