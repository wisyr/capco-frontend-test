import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { startNewApplication } from './support'

/**
 * Scans the page in a real browser for WCAG 2.2 A and AA problems. Unlike
 * jest-axe in jsdom, this also checks colour contrast, because Chromium
 * renders the styles.
 */
async function expectNoAccessibilityViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // React Aria's hidden live region. A pending Button announces itself
    // there through an element labelled by the button, kept for 7 seconds.
    // After navigating away the button is gone, so axe sees an unnamed image
    // that screen readers have already finished announcing.
    .exclude('[data-live-announcer]')
    .analyze()
  const summary = violations.map(
    ({ id, impact, help, nodes }) =>
      `${impact ?? 'unknown'} ${id}: ${help}\n${nodes.map(({ html }) => `  ${html}`).join('\n')}`,
  )
  expect(summary, summary.join('\n\n')).toEqual([])
}

const field = (page: Page, label: string) =>
  page.getByLabel(`${label} (required)`)

test.describe('accessibility', () => {
  test('sign-in, including its errors', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAccessibilityViolations(page)

    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByLabel('Email address')).toBeFocused()
    await expectNoAccessibilityViolations(page)
  })

  test('registration, including its errors', async ({ page }) => {
    await page.goto('/create-account')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAccessibilityViolations(page)

    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByLabel('Email address')).toBeFocused()
    await expectNoAccessibilityViolations(page)
  })

  test('the applicant journey, steps, errors and dialogs', async ({ page }) => {
    await startNewApplication(page)
    await expectNoAccessibilityViolations(page)

    // Validation errors on the first step.
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(field(page, 'Name')).toBeFocused()
    await expectNoAccessibilityViolations(page)

    // The leave dialog.
    await field(page, 'Name').fill('Dorothy Vaughan')
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(
      page.getByRole('alertdialog', { name: 'Leave without saving?' }),
    ).toBeVisible()
    await expectNoAccessibilityViolations(page)
    await page.getByRole('button', { name: 'Leave without saving' }).click()

    // The start or resume page.
    await expect(
      page.getByRole('button', { name: /(Start|Resume) application/ }),
    ).toBeVisible()
    await expectNoAccessibilityViolations(page)

    // The second step and the review page, reached by URL.
    const applicationUrl = page.url()
    await page
      .getByRole('button', { name: /(Start|Resume) application/ })
      .click()
    await expect(field(page, 'Name')).toBeVisible()
    const stepUrl = page.url()
    await page.goto(
      stepUrl.replace(/personal-details$/, 'identity-and-address'),
    )
    await expect(field(page, 'City')).toBeVisible()
    await expectNoAccessibilityViolations(page)

    // The draft is incomplete, so the review lists what is missing.
    await page.goto(stepUrl.replace(/personal-details$/, 'review'))
    await expect(
      page.getByRole('link', { name: 'Complete personal details' }),
    ).toBeVisible()
    await expectNoAccessibilityViolations(page)
    expect(applicationUrl).toMatch(/\/applications\/current$/)
  })
})
