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
const JsdomFormData = globalThis.FormData

/**
 * Node's FormData, which can also be built from a jsdom form, as React DOM
 * does when a submit starts a transition, such as an immediate navigation.
 * Only text entries are copied: a jsdom File is not a Node File.
 */
class TestFormData extends NodeFormData {
  constructor(form?: HTMLFormElement, submitter?: HTMLElement | null) {
    super()
    if (form) {
      for (const [name, value] of new JsdomFormData(form, submitter)) {
        if (typeof value === 'string') {
          this.append(name, value)
        }
      }
    }
  }
}
Object.assign(globalThis, { File: NodeFile, FormData: TestFormData })

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
