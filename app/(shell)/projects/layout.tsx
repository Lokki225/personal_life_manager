import type { PropsWithChildren } from 'react'
import { redirect } from 'next/navigation'

import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

import { canUseProjects } from './access'

// Projects are shared by every node, and open only to those they are open to.
export default async function ProjectsLayout({ children }: PropsWithChildren) {
  if (!canUseProjects(await getSignedInUser())) {
    redirect('/finance')
  }

  return children
}
