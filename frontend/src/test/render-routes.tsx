import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRoutesStub, useLocation } from 'react-router'

type StubRoutes = Parameters<typeof createRoutesStub>[0]

/** Renders route components with a router stub and an isolated query client. */
export function renderRoutes(routes: StubRoutes, initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Stub = createRoutesStub(routes)
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Stub initialEntries={[initialEntry]} />
    </QueryClientProvider>,
  )
  return { queryClient, user, ...view }
}

/** Route element that shows where navigation ended up, for assertions. */
export function LocationProbe() {
  const { pathname, search, state } = useLocation()
  return (
    <output aria-label="Current location">
      {pathname}
      {search}
      {state ? ` state=${JSON.stringify(state)}` : ''}
    </output>
  )
}
