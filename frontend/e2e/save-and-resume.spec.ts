import { expect, test, type Page } from '@playwright/test'

import { signIn, startNewApplication } from './support'

/** A valid 1×1 PNG, so the API accepts it as identity document evidence. */
const passportImage = {
  name: 'passport.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

const field = (page: Page, label: string) =>
  page.getByLabel(`${label} (required)`)

test('saved answers survive signing out and back in', async ({ page }) => {
  const email = await startNewApplication(page)

  // Continue needs every answer, so try it once on an empty step.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(field(page, 'Name')).toBeFocused()
  await expect(field(page, 'Name')).toHaveAccessibleDescription(
    'Enter your name.',
  )

  // Save keeps a half-finished step.
  await field(page, 'Name').fill('Ada Lovelace')
  await field(page, 'Date of birth').fill('1815-12-10')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Your answers have been saved.')).toBeVisible()

  await field(page, 'Country').fill('United Kingdom')
  await field(page, 'Nationality').fill('British')
  await field(page, 'Email').fill('ada@example.com')
  await field(page, 'Phone').fill('+44 20 7946 0000')
  await page.getByRole('checkbox', { name: /I confirm these details/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await field(page, 'City').fill('London')
  await field(page, 'Postal code').fill('SW1Y 4JH')
  await page
    .getByLabel('Document evidence (required)')
    .setInputFiles(passportImage)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByText('Your answers and document have been saved.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)

  // The API's journey URL opens the draft at its current step, which is
  // step 2 now that step 1 is complete.
  await signIn(page, email)
  await expect(page).toHaveURL(/\/applications\/[\w-]+\/identity-and-address$/)

  await expect(field(page, 'City')).toHaveValue('London')
  await expect(field(page, 'Postal code')).toHaveValue('SW1Y 4JH')
  await expect(field(page, 'Street')).toHaveValue('')
  await expect(page.getByText(/A document is already on file/)).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(field(page, 'Name')).toHaveValue('Ada Lovelace')
  await expect(field(page, 'Date of birth')).toHaveValue('1815-12-10')
  await expect(field(page, 'Country')).toHaveValue('United Kingdom')
  await expect(field(page, 'Nationality')).toHaveValue('British')
  await expect(field(page, 'Email')).toHaveValue('ada@example.com')
  await expect(field(page, 'Phone')).toHaveValue('+44 20 7946 0000')
  await expect(
    page.getByRole('checkbox', { name: /I confirm these details/ }),
  ).toBeChecked()
})

test('an expired session keeps the entered answers and explains what to do', async ({
  page,
}) => {
  await startNewApplication(page)
  await field(page, 'Name').fill('Grace Hopper')

  await page.context().clearCookies()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'Your session has ended, so your latest changes were not saved.',
  )
  await expect(page.getByText('Your answers have been saved.')).toBeHidden()
  await expect(field(page, 'Name')).toHaveValue('Grace Hopper')
})

test('leaving a step with unsaved answers asks first', async ({ page }) => {
  await startNewApplication(page)
  await field(page, 'Name').fill('Katherine Johnson')

  await page.getByRole('button', { name: 'Back' }).click()
  const dialog = page.getByRole('alertdialog', {
    name: 'Leave without saving?',
  })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Stay on this page' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  await expect(field(page, 'Name')).toHaveValue('Katherine Johnson')

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Your answers have been saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL(/\/applications\/current$/)
})

test('the header title leads back to the journey, guarding unsaved answers', async ({
  page,
}) => {
  await startNewApplication(page)
  await field(page, 'Name').fill('Mary Jackson')

  await page.getByRole('link', { name: 'KYC Application' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Leave without saving?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Leave without saving' }).click()

  await expect(page).toHaveURL(/\/applications\/current$/)
  await expect(
    page.getByRole('link', { name: 'KYC Application' }),
  ).toHaveAttribute('aria-current', 'page')
})
