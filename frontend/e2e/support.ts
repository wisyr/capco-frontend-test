import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const password = 'Kyc-e2e-1'

/** A unique email address so tests never collide in the shared database. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

export async function registerApplicant(
  request: APIRequestContext,
  email: string,
) {
  const response = await request.post('/api/v1/applicant-accounts', {
    headers: { 'Content-Type': 'application/vnd.api+json' },
    data: {
      data: { type: 'applicant-accounts', attributes: { email, password } },
    },
  })
  expect(response.status()).toBe(201)
}

export async function signIn(
  page: Page,
  email: string,
  withPassword = password,
) {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(withPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Registers a new applicant, signs in and opens the first step of a draft. */
export async function startNewApplication(page: Page) {
  const email = uniqueEmail('applicant')
  await registerApplicant(page.request, email)
  await signIn(page, email)
  await page.getByRole('button', { name: 'Start application' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Personal details' }),
  ).toBeVisible()
  return email
}
