import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { TextField } from './Primitives'
import styles from './Primitives.module.css'

expect.extend(toHaveNoViolations)

describe('TextField', () => {
  it('describes the field with its helper text', () => {
    render(
      <TextField label="Password" helperText="Use 6 or more characters." />,
    )

    const input = screen.getByLabelText('Password')
    const helper = screen.getByText('Use 6 or more characters.')
    expect(input.getAttribute('aria-describedby')).toContain(helper.id)
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(helper.classList.contains(styles.errorMessage)).toBe(false)
  })

  it('marks an error as invalid and styles its message as an error', async () => {
    const { container } = render(
      <TextField error label="Password" helperText="Enter a password." />,
    )

    const input = screen.getByLabelText('Password')
    const message = screen.getByText('Enter a password.')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain(message.id)
    expect(message.classList.contains(styles.errorMessage)).toBe(true)
    expect(await axe(container)).toHaveNoViolations()
  })
})
