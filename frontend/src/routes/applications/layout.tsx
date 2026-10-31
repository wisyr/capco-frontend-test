import { Alert, Button, ConfirmDialog, Link, Typography } from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useBlocker, useLocation, useNavigate } from 'react-router'

import { deleteApplicantSession } from '../../api/applicant-sessions'
import { requestFailureMessage } from '../../api/request-failure-message'
import styles from '../../features/applicant-journey/applicant-header.module.css'
import { isSessionExpired } from '../../features/applicant-journey/session'
import { UnsavedChangesContext } from '../../features/applicant-journey/unsaved-changes'

/** Where the header title leads: the start or resume page of the journey. */
const journeyHref = '/applications/current'

export default function ApplicationsLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const signedOut = useRef(false)
  // A ref, not state: a step clears it right before navigating after a save,
  // and the blocker must see that in the same event.
  const unsavedChanges = useRef(false)
  const reportUnsavedChanges = useCallback((hasUnsavedChanges: boolean) => {
    unsavedChanges.current = hasUnsavedChanges
  }, [])
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const leaveBlocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsavedChanges.current &&
      !signedOut.current &&
      currentLocation.pathname !== nextLocation.pathname,
  )

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
        <Link
          aria-current={pathname === journeyHref ? 'page' : undefined}
          className={styles.homeLink}
          href={journeyHref}
        >
          <Typography
            className={styles.title}
            component="span"
            variant="subheading"
          >
            KYC Application
          </Typography>
        </Link>
        <Button
          className={styles.signOut}
          isPending={signOut.isPending}
          onPress={() => {
            // Ask before ending the session, while the answers can still be
            // saved.
            if (unsavedChanges.current) {
              setConfirmingSignOut(true)
            } else {
              signOut.mutate()
            }
          }}
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
      <UnsavedChangesContext value={reportUnsavedChanges}>
        <Outlet />
      </UnsavedChangesContext>
      <ConfirmDialog
        cancelLabel="Stay on this page"
        confirmLabel="Leave without saving"
        isOpen={leaveBlocker.state === 'blocked'}
        onCancel={() => leaveBlocker.reset?.()}
        onConfirm={() => leaveBlocker.proceed?.()}
        title="Leave without saving?"
      >
        Your changes on this step have not been saved. If you leave now, they
        will be lost.
      </ConfirmDialog>
      <ConfirmDialog
        cancelLabel="Stay on this page"
        confirmLabel="Sign out without saving"
        isOpen={confirmingSignOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false)
          signOut.mutate()
        }}
        title="Sign out without saving?"
      >
        Your changes on this step have not been saved. If you sign out now, they
        will be lost.
      </ConfirmDialog>
    </>
  )
}
