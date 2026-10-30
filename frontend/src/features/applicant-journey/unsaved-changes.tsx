import { createContext, use, useEffect } from 'react'

type ReportUnsavedChanges = (hasUnsavedChanges: boolean) => void

/**
 * Lets the open step tell the journey layout whether it has answers the API
 * has not saved, so the layout can ask before the applicant leaves.
 */
export const UnsavedChangesContext = createContext<ReportUnsavedChanges>(
  () => {},
)

/**
 * Reports unsaved answers to the journey layout and asks the browser to
 * confirm before the tab is closed or reloaded while there are any. Returns
 * the reporter, so a step can clear it right before moving on after a save.
 */
export function useUnsavedChangesGuard(
  hasUnsavedChanges: boolean,
): ReportUnsavedChanges {
  const reportUnsavedChanges = use(UnsavedChangesContext)

  useEffect(() => {
    reportUnsavedChanges(hasUnsavedChanges)
    return () => reportUnsavedChanges(false)
  }, [hasUnsavedChanges, reportUnsavedChanges])

  useEffect(() => {
    // Listen only while needed: a beforeunload listener can stop the browser
    // from keeping the page in its back/forward cache.
    if (!hasUnsavedChanges) {
      return undefined
    }
    const confirmUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', confirmUnload)
    return () => window.removeEventListener('beforeunload', confirmUnload)
  }, [hasUnsavedChanges])

  return reportUnsavedChanges
}
