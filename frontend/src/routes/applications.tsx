import { Alert, Button, Typography } from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router'

import { deleteApplicantSession } from '../api/applicant-sessions'
import { requestFailureMessage } from '../api/request-failure-message'

import styles from './applicant-header.module.css'
import { isSessionExpired } from './applications/-session'

export default function ApplicationsLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signedOut = useRef(false)

  // Forget cached applicant data only once the journey has unmounted.
  // Removing queries a page still observes makes it refetch them straight
  // away, without a session.
  useEffect(
    () => () => {
      if (signedOut.current) {
        queryClient.removeQueries()
      }
    },
    [queryClient],
  )

  const signOut = useMutation({
    mutationFn: deleteApplicantSession,
    onSettled: (_, error) => {
      // A 401 means the session had already ended, which is still signed out.
      if (!error || isSessionExpired(error)) {
        signedOut.current = true
        void navigate('/sign-in', { replace: true })
      }
    },
  })
  const signOutFailed = signOut.isError && !isSessionExpired(signOut.error)

  return (
    <>
      <header className={styles.header}>
        <Typography component="span" variant="subheading">
          KYC Application
        </Typography>
        <Button
          className={styles.signOut}
          isPending={signOut.isPending}
          onPress={() => signOut.mutate()}
          variant="secondary"
        >
          Sign out
        </Button>
      </header>
      {signOutFailed ? (
        <Alert className={styles.alert} severity="error">
          We could not sign you out. {requestFailureMessage(signOut.error)}
        </Alert>
      ) : null}
      <Outlet />
    </>
  )
}
