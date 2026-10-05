import type { SignedInUser } from '@/infrastructure/auth/sessionUser'
import { canOpenProjects } from '@/lib/nav/registry'

// Whether this person may use /projects yet: administrators while it is
// built, everyone once it launches (see PROJECTS in lib/nav/registry.ts).
export const canUseProjects = (user: Pick<SignedInUser, 'role'> | null): user is SignedInUser =>
  user !== null && canOpenProjects(user.role === 'ADMIN')
