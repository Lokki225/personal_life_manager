import type { SignedInUser } from '@/infrastructure/auth/sessionUser'
import { canOpen, getNode } from '@/lib/nav/registry'

// Whether this person may use Personal yet: everyone once it launches, only
// administrators while it is being built (see lib/nav/registry.ts).
export const canUsePersonal = (user: Pick<SignedInUser, 'role'> | null): user is SignedInUser =>
  user !== null && canOpen(getNode('personal'), user.role === 'ADMIN')
