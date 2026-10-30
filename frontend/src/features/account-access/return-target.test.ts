import { describe, expect, it } from 'vitest'

import {
  accountAccessHref,
  isSafeJourneyPath,
  parseAccountAccessSearch,
} from './return-target'

describe('isSafeJourneyPath', () => {
  it.each([
    '/applications/current',
    '/applications/42/personal-details',
    '/applications/42/personal-details?step=1',
  ])('allows the journey path %s', (path) => {
    expect(isSafeJourneyPath(path)).toBe(true)
  })

  it.each([
    '/applications/../reviewer/applications',
    '/applications/current/../../sign-in',
    '/applications',
    '/reviewer/applications',
    '//evil.example/applications/current',
    'https://evil.example/applications/current',
    'applications/current',
  ])('rejects %s', (path) => {
    expect(isSafeJourneyPath(path)).toBe(false)
  })
})

describe('parseAccountAccessSearch', () => {
  it('keeps a safe returnTo and drops anything else', () => {
    expect(
      parseAccountAccessSearch({ returnTo: '/applications/current' }),
    ).toEqual({ returnTo: '/applications/current' })
    expect(
      parseAccountAccessSearch({
        returnTo: '/applications/../reviewer/applications',
      }),
    ).toEqual({})
    expect(parseAccountAccessSearch({ returnTo: ['/applications/x'] })).toEqual(
      {},
    )
  })
})

describe('accountAccessHref', () => {
  it('encodes returnTo into the query string', () => {
    expect(accountAccessHref('/sign-in', '/applications/current')).toBe(
      '/sign-in?returnTo=%2Fapplications%2Fcurrent',
    )
    expect(accountAccessHref('/create-account')).toBe('/create-account')
  })
})
