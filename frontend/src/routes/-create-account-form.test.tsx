import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../test/server'

import { CreateAccountForm } from './-create-account-form'

expect.extend(toHaveNoViolations)

const ACCOUNTS_URL = '/api/v1/applicant-accounts'

function renderForm(returnTo?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CreateAccountForm returnTo={returnTo} />
    </QueryClientProvider>,
  )
  return { user, ...view }
}

const emailInput = () => screen.getByLabelText('Email address')
const passwordInput = () => screen.getByLabelText('Password')
const confirmationInput = () => screen.getByLabelText('Confirm password')
const submitButton = () =>
  screen.getByRole('button', { name: /^(create account|creating account…)$/i })

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(emailInput(), 'ada@example.com')
  await user.type(passwordInput(), 'Secret!')
  await user.type(confirmationInput(), 'Secret!')
}

function respondWith(status: number, body?: object, headers?: HeadersInit) {
  server.use(
    http.post(ACCOUNTS_URL, () =>
      body
        ? HttpResponse.json(body, { status, headers })
        : new HttpResponse(null, { status, headers }),
    ),
  )
}

function errorDocument(code: string, detail: string, pointer?: string) {
  return {
    errors: [
      {
        status: '400',
        code,
        title: 'Error',
        detail,
        ...(pointer ? { source: { pointer } } : {}),
      },
    ],
  }
}

describe('CreateAccountForm', () => {
  it('labels every field and explains the password policy', async () => {
    const { container } = renderForm()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(emailInput()).toBeRequired()
    expect(passwordInput()).toHaveAccessibleDescription(
      'Use at least 6 characters, including an uppercase letter and a special character.',
    )
    expect(confirmationInput()).toBeRequired()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows field errors, focuses the first invalid field and does not submit', async () => {
    let requests = 0
    server.use(
      http.post(ACCOUNTS_URL, () => {
        requests += 1
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const { user, container } = renderForm()

    await user.type(passwordInput(), 'secret')
    await user.click(submitButton())

    expect(emailInput()).toHaveFocus()
    expect(emailInput()).toBeInvalid()
    expect(emailInput()).toHaveAccessibleDescription(
      'Enter your email address.',
    )
    expect(passwordInput()).toHaveAccessibleDescription(
      'Password must include an uppercase letter.',
    )
    expect(confirmationInput()).toHaveAccessibleDescription(
      'Confirm your password.',
    )
    expect(requests).toBe(0)
    expect(await axe(container)).toHaveNoViolations()

    await user.type(emailInput(), 'a')
    expect(emailInput()).not.toHaveAttribute('aria-invalid')
  })

  it('reports mismatched passwords on the confirmation field', async () => {
    const { user } = renderForm()

    await user.type(emailInput(), 'ada@example.com')
    await user.type(passwordInput(), 'Secret!')
    await user.type(confirmationInput(), 'Secret?')
    await user.click(submitButton())

    expect(confirmationInput()).toHaveFocus()
    expect(confirmationInput()).toHaveAccessibleDescription(
      'Passwords do not match.',
    )
  })

  it('registers with a JSON:API document and confirms without signing in', async () => {
    let request: Request | undefined
    server.use(
      http.post(ACCOUNTS_URL, ({ request: received }) => {
        request = received.clone()
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const { user, container } = renderForm('/applications/current')

    await fillValidForm(user)
    await user.click(submitButton())

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Account created',
    })
    expect(heading.closest('[tabindex="-1"]')).toHaveFocus()
    expect(
      screen.getByText(/your account for ada@example.com is ready/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Fapplications%2Fcurrent',
    )
    expect(request?.headers.get('Content-Type')).toBe(
      'application/vnd.api+json',
    )
    expect(await request?.json()).toEqual({
      data: {
        type: 'applicant-accounts',
        attributes: { email: 'ada@example.com', password: 'Secret!' },
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows the pending state and ignores repeated submissions', async () => {
    let requests = 0
    server.use(
      http.post(ACCOUNTS_URL, async () => {
        requests += 1
        await delay(50)
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const { user } = renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(submitButton()).toHaveTextContent('Creating account…')
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true')
    await user.click(submitButton())
    await user.keyboard('{Enter}')

    await screen.findByRole('heading', { name: 'Account created' })
    expect(requests).toBe(1)
  })

  it('shows API validation errors beside the matching fields', async () => {
    respondWith(400, {
      errors: [
        errorDocument(
          'validation-failed',
          'Enter a valid email address.',
          '/data/attributes/email',
        ).errors[0],
        errorDocument(
          'validation-failed',
          'Use at least 6 characters including an uppercase letter and special character.',
          '/data/attributes/password',
        ).errors[0],
      ],
    })
    const { user } = renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument()
    expect(emailInput()).toHaveFocus()
    expect(passwordInput()).toHaveAccessibleDescription(
      'Use at least 6 characters including an uppercase letter and special character.',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers sign-in when the email address is already registered', async () => {
    respondWith(409, {
      errors: [
        {
          status: '409',
          code: 'email-already-registered',
          title: 'Account conflict',
          detail: 'An account already exists for this email address.',
        },
      ],
    })
    const { user } = renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'An account already exists for this email address. Sign in or use a different email address.',
    )
    expect(
      within(alert).getByRole('link', { name: 'Sign in' }),
    ).toHaveAttribute('href', '/sign-in')
  })

  it.each([
    [
      'rate limiting',
      () =>
        respondWith(429, errorDocument('rate-limited', 'Too many attempts.'), {
          'Retry-After': '120',
        }),
      'Too many attempts. Wait 2 minutes and try again.',
    ],
    [
      'a network failure',
      () => server.use(http.post(ACCOUNTS_URL, () => HttpResponse.error())),
      'We could not connect to the service. Check your internet connection and try again.',
    ],
    [
      'a malformed request',
      () =>
        respondWith(
          400,
          errorDocument('malformed-document', 'Malformed JSON:API document'),
        ),
      'We could not process your details. Check them and try again.',
    ],
    [
      'an unexpected error',
      () => respondWith(500),
      'Something went wrong. Try again later.',
    ],
  ])(
    'explains %s and keeps the entered values',
    async (_, arrange, message) => {
      arrange()
      const { user } = renderForm()

      await fillValidForm(user)
      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(emailInput()).toHaveValue('ada@example.com')
      expect(passwordInput()).toHaveValue('Secret!')
      expect(submitButton()).toHaveTextContent('Create account')
    },
  )
})
