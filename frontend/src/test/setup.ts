import { File as NodeFile } from 'node:buffer'

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { server } from './server'

if (!globalThis.CSS) {
  Object.defineProperty(globalThis, 'CSS', { configurable: true, value: {} })
}

// Tests run on Node's fetch, which can only send its own FormData and File.
// jsdom replaces both globals with versions fetch rejects, so restore Node's
// to let uploads behave as they do in a browser.
const NodeFormData = (await new Response(new URLSearchParams()).formData())
  .constructor as typeof FormData
Object.assign(globalThis, { File: NodeFile, FormData: NodeFormData })

if (typeof CSS.escape !== 'function') {
  Object.defineProperty(CSS, 'escape', {
    configurable: true,
    value: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
