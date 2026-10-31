import { expect, test } from '@playwright/test'

import { password, registerApplicant, signIn, uniqueEmail } from './support'

test('an applicant signs in and reaches the journey URL from the API', async ({
  page,
}) => {
  const email = uniqueEmail('login')
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
  const email = uniqueEmail('login-wrong')
  await registerApplicant(page.request, email)

  await signIn(page, email, 'Wrong-password-1')

  await expect(page.getByRole('alert')).toHaveText(
    'The email address or password is incorrect.',
  )
  await expect(page.getByLabel('Email address')).toHaveValue(email)
  await expect(page.getByLabel('Password')).toHaveValue('')
  await expect(page).toHaveURL(/\/sign-in$/)
})
