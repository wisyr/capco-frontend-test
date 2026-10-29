import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  /** Also called for Escape, so dismissing never confirms. */
  onCancel: () => void
}

/**
 * Asks the user to confirm an action with consequences. It opens as an
 * alert dialog that traps focus, starting on the safe cancel action, and
 * returns focus to where it was when it closes.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalOverlay
      className={styles.overlay}
      isDismissable={false}
      isKeyboardDismissDisabled={false}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      <Modal className={styles.modal}>
        <Dialog className={styles.dialog} role="alertdialog">
          <Heading className={styles.title} slot="title">
            {title}
          </Heading>
          <div className={styles.message}>{children}</div>
          <div className={styles.actions}>
            <Button autoFocus onPress={onCancel} variant="secondary">
              {cancelLabel}
            </Button>
            <Button onPress={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
