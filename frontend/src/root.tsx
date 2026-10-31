import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RouterProvider } from 'react-aria-components'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useHref,
  useNavigate,
  useRouteError,
} from 'react-router'

import { createQueryClient } from './api/query-client'
import './styles.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  const navigate = useNavigate()
  return (
    <QueryClientProvider client={queryClient}>
      {/* Lets React Aria components with an href, such as Link, use client-side routing. */}
      <RouterProvider
        navigate={(href) => {
          void navigate(href)
        }}
        useHref={useHref}
      >
        <Outlet />
      </RouterProvider>
    </QueryClientProvider>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const heading = notFound ? 'Page not found' : 'Something went wrong'
  return (
    <main>
      <title>{`${heading} | KYC`}</title>
      <h1>{heading}</h1>
      <p>
        {notFound
          ? 'The page you requested does not exist.'
          : 'Please try again.'}
      </p>
      {/* A full page load, which also starts the app afresh after an error. */}
      <p>
        <a href="/applications/current">Go to your application</a>
      </p>
    </main>
  )
}
