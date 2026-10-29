/**
 * Announces a pending request to screen readers wherever focus is. React
 * Aria's Button only announces its pending state while the button itself has
 * focus, but forms are usually submitted by pressing Enter in a field.
 *
 * The live region stays mounted so screen readers notice when text appears.
 */
export function PendingStatus({ message }: { message: string | undefined }) {
  return (
    <span className="sr-only" role="status">
      {message}
    </span>
  )
}
