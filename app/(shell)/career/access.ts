import type { SignedInUser } from '@/infrastructure/auth/sessionUser'
import { canOpen, getNode } from '@/lib/nav/registry'

// Whether this person may use Career yet: only administrators while it is
// being built, everyone once it launches (see lib/nav/registry.ts).
export const canUseCareer = (user: Pick<SignedInUser, 'role'> | null): user is SignedInUser =>
  user !== null && canOpen(getNode('career'), user.role === 'ADMIN')
