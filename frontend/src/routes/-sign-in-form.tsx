import { Alert, Button, Link, Stack, TextField, Typography } from '@kyc/ui'
import { useMutation } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'

import { createApplicantSession } from '../api/applicant-sessions'
import { ApiError, UnexpectedResponseError } from '../api/json-api-client'
import { requestFailureMessage } from '../api/request-failure-message'

import { AccountAccessCard } from './-account-access-card'
import { credentialFieldErrors } from './-credential-field-errors'
import { accountAccessHref, isSafeJourneyPath } from './-return-target'
import { useFieldErrors, type FieldErrors } from './-use-field-errors'
import styles from './account-access.module.css'

export interface SignInFormProps {
  returnTo?: string
  onSuccess: (href: string) => void
}

type SignInField = 'email' | 'password'
type SignInValues = Record<SignInField, string>

/** Input ids, in the order focus moves to the first invalid field. */
const fieldIds: Record<SignInField, string> = {
  email: 'applicant-email',
  password: 'applicant-password',
}

export function SignInForm({ returnTo, onSuccess }: SignInFormProps) {
  const [values, setValues] = useState<SignInValues>({
    email: '',
    password: '',
  })
  const { fieldErrors, showFieldErrors, clearFieldError, clearFieldErrors } =
    useFieldErrors(fieldIds)
  const signIn = useMutation({
    mutationFn: async (credentials: SignInValues) => {
      const { journeyHref } = await createApplicantSession(credentials)
      const destination = returnTo ?? journeyHref
      // Never follow a journey URL that leaves the applicant journey.
      if (!isSafeJourneyPath(destination)) {
        throw new UnexpectedResponseError(
          `Refusing to navigate to ${destination}.`,
        )
      }
      return destination
    },
    onSuccess: (destination) => onSuccess(destination),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        // Ask for the password again; the email address is kept.
        setValues((current) => ({ ...current, password: '' }))
      }
      const apiFieldErrors = credentialFieldErrors(error)
      if (apiFieldErrors) {
        showFieldErrors(apiFieldErrors)
      }
    },
  })

  function submit() {
    if (signIn.isPending) {
      return
    }
    const credentials = {
      email: values.email.trim(),
      password: values.password,
    }
    const errors = requiredFieldErrors(credentials)
    if (errors) {
      showFieldErrors(errors)
      return
    }
    clearFieldErrors()
    signIn.mutate(credentials)
  }

  function fieldProps(field: SignInField) {
    return {
      error: Boolean(fieldErrors[field]),
      fullWidth: true,
      helperText: fieldErrors[field],
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

  const formError = signIn.isError ? signInFormError(signIn.error) : undefined

  return (
    <AccountAccessCard>
      <title>Sign in | KYC</title>
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
            Welcome back
          </Typography>
          <Typography tone="muted">
            Sign in to continue your KYC application.
          </Typography>
        </Stack>
        {formError ? <Alert severity="error">{formError}</Alert> : null}
        <TextField
          {...fieldProps('email')}
          autoComplete="email"
          label="Email address"
          spellCheck={false}
          type="email"
        />
        <TextField
          {...fieldProps('password')}
          autoComplete="current-password"
          label="Password"
          type="password"
        />
        <Button
          className={styles.submit}
          fullWidth
          isPending={signIn.isPending}
          size="large"
          type="submit"
        >
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
        <Typography className={styles.footer} align="center" variant="caption">
          <span>New to KYC? </span>
          <Link href={accountAccessHref('/create-account', returnTo)}>
            Create account
          </Link>
        </Typography>
      </Stack>
    </AccountAccessCard>
  )
}

function requiredFieldErrors({
  email,
  password,
}: SignInValues): FieldErrors<SignInField> | undefined {
  if (email && password) {
    return undefined
  }
  return {
    email: email ? undefined : 'Enter your email address.',
    password: password ? undefined : 'Enter your password.',
  }
}

/** Form-level feedback for failures that are not shown beside a field. */
function signInFormError(error: Error): string | undefined {
  if (credentialFieldErrors(error)) {
    return undefined
  }
  if (error instanceof ApiError && error.status === 401) {
    // The API answers unknown emails and wrong passwords identically.
    return 'The email address or password is incorrect.'
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'We could not process your details. Check them and try again.'
  }
  return requestFailureMessage(error)
}
