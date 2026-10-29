import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

const password = 'Kyc-e2e-1'

async function registerApplicant(request: APIRequestContext, email: string) {
  const response = await request.post('/api/v1/applicant-accounts', {
    headers: { 'Content-Type': 'application/vnd.api+json' },
    data: {
      data: { type: 'applicant-accounts', attributes: { email, password } },
    },
  })
  expect(response.status()).toBe(201)
}

async function signIn(page: Page, email: string, withPassword: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(withPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('an applicant signs in and reaches the journey URL from the API', async ({
  page,
}) => {
  const email = `login-${Date.now()}@example.test`
  await registerApplicant(page.request, email)

  await signIn(page, email, password)

  await expect(page).toHaveURL(/\/applications\/current$/)
  const cookies = await page.context().cookies()
  expect(cookies.map(({ name }) => name)).toEqual(
    expect.arrayContaining(['__Host-KYCSESSION', 'XSRF-TOKEN']),
  )
  await page.goBack()
  await expect(page).not.toHaveURL(/\/sign-in/)
})

test('wrong credentials show a generic error and keep the email', async ({
  page,
}) => {
  const email = `login-wrong-${Date.now()}@example.test`
  await registerApplicant(page.request, email)

  await signIn(page, email, 'Wrong-password-1')

  await expect(page.getByRole('alert')).toHaveText(
    'The email address or password is incorrect.',
  )
  await expect(page.getByLabel('Email address')).toHaveValue(email)
  await expect(page.getByLabel('Password')).toHaveValue('')
  await expect(page).toHaveURL(/\/sign-in$/)
})
