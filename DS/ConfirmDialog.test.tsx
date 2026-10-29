import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

expect.extend(toHaveNoViolations)

function renderDialog() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  function Example() {
    const [isOpen, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)} type="button">
          Leave page
        </button>
        <ConfirmDialog
          cancelLabel="Stay on this page"
          confirmLabel="Leave without saving"
          isOpen={isOpen}
          onCancel={() => {
            onCancel()
            setOpen(false)
          }}
          onConfirm={() => {
            onConfirm()
            setOpen(false)
          }}
          title="Leave without saving?"
        >
          Your changes have not been saved.
        </ConfirmDialog>
      </>
    )
  }
  render(<Example />)
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('opens as a labelled alert dialog focused on the safe action', async () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Leave page' }))

    const dialog = screen.getByRole('alertdialog', {
      name: 'Leave without saving?',
    })
    expect(dialog.textContent).toContain('Your changes have not been saved.')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Stay on this page' }),
      ),
    )
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('confirms only when the confirm action is chosen', async () => {
    const { onConfirm, onCancel } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Leave page' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Leave without saving' }),
    )

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it.each([
    ['the cancel action', 'click'],
    ['Escape', 'escape'],
  ] as const)(
    'cancels with %s and returns focus to the trigger',
    async (_, how) => {
      const { onConfirm, onCancel } = renderDialog()
      const trigger = screen.getByRole('button', { name: 'Leave page' })
      const cancel = () =>
        screen.getByRole('button', { name: 'Stay on this page' })

      trigger.focus()
      fireEvent.click(trigger)
      await waitFor(() => expect(document.activeElement).toBe(cancel()))
      if (how === 'click') {
        fireEvent.click(cancel())
      } else {
        fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      }

      expect(onCancel).toHaveBeenCalledOnce()
      expect(onConfirm).not.toHaveBeenCalled()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    },
  )
})
