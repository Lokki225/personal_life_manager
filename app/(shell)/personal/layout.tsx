import type { PropsWithChildren } from 'react'
import { redirect } from 'next/navigation'

import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

import { canUsePersonal } from './access'

// Personal opens only to those it is open to (administrators while it is
// being built). Everyone else goes back to Finance.
export default async function PersonalLayout({ children }: PropsWithChildren) {
  if (!canUsePersonal(await getSignedInUser())) {
    redirect('/finance')
  }

  return children
}
