import { expect, test, type Page } from '@playwright/test'

const password = 'Kyc-e2e-1'

async function register(page: Page, email: string) {
  await page.goto('/create-account')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
}

test('an applicant registers and is sent to sign in', async ({ page }) => {
  const email = `registration-${Date.now()}@example.test`

  await register(page, email)

  await expect(
    page.getByRole('heading', { level: 1, name: 'Account created' }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Account created | KYC')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('registering an existing email address offers sign-in', async ({
  page,
}) => {
  const email = `duplicate-${Date.now()}@example.test`
  await register(page, email)
  await expect(
    page.getByRole('heading', { name: 'Account created' }),
  ).toBeVisible()

  await register(page, email)

  await expect(page.getByRole('alert')).toContainText(
    'An account already exists for this email address.',
  )
  await expect(page.getByLabel('Email address')).toHaveValue(email)
})
