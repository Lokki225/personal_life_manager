import type { PropsWithChildren } from 'react'
import { redirect } from 'next/navigation'

import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

import { canUseCareer } from './access'

// Career opens only to those it is open to (administrators while it is being
// built). Everyone else goes back to Finance. It works online only: nothing of
// it is kept on the device, compensation least of all.
export default async function CareerLayout({ children }: PropsWithChildren) {
  if (!canUseCareer(await getSignedInUser())) {
    redirect('/finance')
  }

  return children
}
