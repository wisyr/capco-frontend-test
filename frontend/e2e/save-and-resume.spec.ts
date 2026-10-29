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

  await field(page, 'Name').fill('Ada Lovelace')
  await field(page, 'Date of birth').fill('1815-12-10')
  await field(page, 'Nationality').fill('British')
  await page.getByRole('checkbox', { name: /I confirm these details/ }).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Your answers have been saved.')).toBeVisible()

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

  // With a draft in progress, the API's journey URL opens it directly.
  await signIn(page, email)
  await expect(page).toHaveURL(/\/applications\/[\w-]+\/personal-details$/)

  await expect(field(page, 'Name')).toHaveValue('Ada Lovelace')
  await expect(field(page, 'Date of birth')).toHaveValue('1815-12-10')
  await expect(field(page, 'Nationality')).toHaveValue('British')
  await expect(field(page, 'Country')).toHaveValue('')
  await expect(
    page.getByRole('checkbox', { name: /I confirm these details/ }),
  ).toBeChecked()

  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(field(page, 'City')).toHaveValue('London')
  await expect(field(page, 'Postal code')).toHaveValue('SW1Y 4JH')
  await expect(page.getByText(/A document is already on file/)).toBeVisible()
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
