import { CreateAccountForm } from '../features/account-access/create-account-form'
import { parseAccountAccessSearch } from '../features/account-access/return-target'

import type { Route } from './+types/create-account'

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const search = Object.fromEntries(new URL(request.url).searchParams)
  return parseAccountAccessSearch(search)
}

export default function CreateAccountRoute({
  loaderData,
}: Route.ComponentProps) {
  return <CreateAccountForm returnTo={loaderData.returnTo} />
}
