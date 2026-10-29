import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '../test/server'

import { SignInForm } from './-sign-in-form'

expect.extend(toHaveNoViolations)

const SESSIONS_URL = '/api/v1/applicant-sessions'

function renderForm(returnTo?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SignInForm onSuccess={onSuccess} returnTo={returnTo} />
    </QueryClientProvider>,
  )
  return { onSuccess, user, ...view }
}

const emailInput = () => screen.getByLabelText('Email address')
const passwordInput = () => screen.getByLabelText('Password')
const submitButton = () =>
  screen.getByRole('button', { name: /^(sign in|signing in…)$/i })

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(emailInput(), 'ada@example.com')
  await user.type(passwordInput(), 'Secret!')
}

function sessionCreated(href = '/applications/current') {
  return HttpResponse.json(
    {
      data: {
        type: 'applicant-sessions',
        id: 'd40af2e3-b811-52ab-a43e-79e7d9139703',
        attributes: { href },
      },
    },
    { status: 201 },
  )
}

function respondWith(status: number, body?: object, headers?: HeadersInit) {
  server.use(
    http.post(SESSIONS_URL, () =>
      body
        ? HttpResponse.json(body, { status, headers })
        : new HttpResponse(null, { status, headers }),
    ),
  )
}

function apiError(
  status: number,
  code: string,
  detail: string,
  pointer?: string,
) {
  return {
    status: String(status),
    code,
    title: 'Error',
    detail,
    ...(pointer ? { source: { pointer } } : {}),
  }
}

describe('SignInForm', () => {
  it('labels both required fields', async () => {
    const { container } = renderForm()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument()
    expect(emailInput()).toBeRequired()
    expect(passwordInput()).toBeRequired()
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('requires both fields before contacting the API', async () => {
    let requests = 0
    server.use(
      http.post(SESSIONS_URL, () => {
        requests += 1
        return sessionCreated()
      }),
    )
    const { user, container } = renderForm()

    await user.type(emailInput(), '   ')
    await user.click(submitButton())

    expect(emailInput()).toHaveFocus()
    expect(emailInput()).toHaveAccessibleDescription(
      'Enter your email address.',
    )
    expect(passwordInput()).toHaveAccessibleDescription('Enter your password.')
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true')
    expect(requests).toBe(0)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('signs in with a JSON:API document and follows the journey URL', async () => {
    let request: Request | undefined
    server.use(
      http.post(SESSIONS_URL, ({ request: received }) => {
        request = received.clone()
        return sessionCreated('/applications/current')
      }),
    )
    const { user, onSuccess } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    await vi.waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('/applications/current'),
    )
    expect(request?.headers.get('Content-Type')).toBe(
      'application/vnd.api+json',
    )
    expect(await request?.json()).toEqual({
      data: {
        type: 'applicant-sessions',
        attributes: { email: 'ada@example.com', password: 'Secret!' },
      },
    })
  })

  it('returns to the page that sent the applicant to sign in', async () => {
    server.use(http.post(SESSIONS_URL, () => sessionCreated()))
    const { user, onSuccess } = renderForm('/applications/42/personal-details')

    await fillForm(user)
    await user.click(submitButton())

    await vi.waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        '/applications/42/personal-details',
      ),
    )
  })

  it('refuses a journey URL outside the applicant journey', async () => {
    server.use(
      http.post(SESSIONS_URL, () => sessionCreated('https://evil.example')),
    )
    const { user, onSuccess } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Try again later.',
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows the pending state and ignores repeated submissions', async () => {
    let requests = 0
    server.use(
      http.post(SESSIONS_URL, async () => {
        requests += 1
        await delay(50)
        return sessionCreated()
      }),
    )
    const { user, onSuccess } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    expect(submitButton()).toHaveTextContent('Signing in…')
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true')
    await user.click(submitButton())
    await user.keyboard('{Enter}')

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(requests).toBe(1)
  })

  it('rejects invalid credentials without revealing which one was wrong', async () => {
    respondWith(401, {
      errors: [
        apiError(401, 'invalid-credentials', 'Invalid email or password'),
      ],
    })
    const { user, container } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email address or password is incorrect.',
    )
    expect(emailInput()).toHaveValue('ada@example.com')
    expect(passwordInput()).toHaveValue('')
    expect(emailInput()).not.toHaveAttribute('aria-invalid')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows API validation errors beside the matching fields', async () => {
    respondWith(400, {
      errors: [
        apiError(
          400,
          'validation-failed',
          'Enter a valid email address.',
          '/data/attributes/email',
        ),
      ],
    })
    const { user } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument()
    expect(emailInput()).toHaveFocus()
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [
      'a malformed request',
      () =>
        respondWith(400, {
          errors: [
            apiError(400, 'malformed-document', 'Malformed JSON:API document'),
          ],
        }),
      'We could not process your details. Check them and try again.',
    ],
    [
      'rate limiting',
      () =>
        respondWith(
          429,
          { errors: [apiError(429, 'rate-limited', 'Too many attempts.')] },
          { 'Retry-After': '30' },
        ),
      'Too many attempts. Wait 30 seconds and try again.',
    ],
    [
      'a network failure',
      () => server.use(http.post(SESSIONS_URL, () => HttpResponse.error())),
      'We could not connect to the service. Check your internet connection and try again.',
    ],
    [
      'a server error',
      () => respondWith(500),
      'Something went wrong. Try again later.',
    ],
    [
      'a response that breaks the contract',
      () =>
        server.use(
          http.post(SESSIONS_URL, () =>
            HttpResponse.json({ data: null }, { status: 201 }),
          ),
        ),
      'Something went wrong. Try again later.',
    ],
  ])(
    'explains %s and keeps the entered values',
    async (_, arrange, message) => {
      arrange()
      const { user, onSuccess } = renderForm()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(emailInput()).toHaveValue('ada@example.com')
      expect(passwordInput()).toHaveValue('Secret!')
      expect(submitButton()).toHaveTextContent('Sign in')
      expect(onSuccess).not.toHaveBeenCalled()
    },
  )
})
