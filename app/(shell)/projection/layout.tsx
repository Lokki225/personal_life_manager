import type { PropsWithChildren } from 'react'
import { redirect } from 'next/navigation'

import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

import { canUseProjection } from './access'

// Projection opens only to those it is open to. Everyone else goes back to
// Finance.
export default async function ProjectionLayout({ children }: PropsWithChildren) {
  if (!canUseProjection(await getSignedInUser())) {
    redirect('/finance')
  }

  return children
}
