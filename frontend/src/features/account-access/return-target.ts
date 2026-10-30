import { resolvePath } from 'react-router'

export interface AccountAccessSearch {
  returnTo?: string
}

/** Restricts post-authentication navigation to local applicant journey paths. */
export function parseAccountAccessSearch(
  search: Record<string, unknown>,
): AccountAccessSearch {
  const returnTo = search.returnTo
  return typeof returnTo === 'string' && isSafeJourneyPath(returnTo)
    ? { returnTo }
    : {}
}

export function isSafeJourneyPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false
  }
  // Check the path React Router will navigate to, so dot segments such as
  // /applications/../reviewer cannot leave the journey.
  return resolvePath(path).pathname.startsWith('/applications/')
}

export function accountAccessHref(
  path: '/sign-in' | '/create-account',
  returnTo?: string,
): string {
  return returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path
}
