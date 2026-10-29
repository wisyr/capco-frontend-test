import { useState } from 'react'
import { flushSync } from 'react-dom'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

/**
 * Error messages shown beside form fields. `fieldIds` maps each field to its
 * input id, listed in the order focus should reach the first invalid field.
 */
export function useFieldErrors<Field extends string>(
  fieldIds: Readonly<Record<Field, string>>,
) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({})

  /** Renders the errors before moving focus so the field announces them. */
  function showFieldErrors(errors: FieldErrors<Field>) {
    flushSync(() => setFieldErrors(errors))
    // Object keys keep their declaration order, which is the focus order.
    const fields = Object.keys(fieldIds) as Field[]
    const firstInvalid = fields.find((field) => errors[field])
    if (firstInvalid) {
      document.getElementById(fieldIds[firstInvalid])?.focus()
    }
  }

  function clearFieldError(field: Field) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function clearFieldErrors() {
    setFieldErrors({})
  }

  return { fieldErrors, showFieldErrors, clearFieldError, clearFieldErrors }
}
