import type { SignedInUser } from '@/infrastructure/auth/sessionUser'
import { canOpen, getNode } from '@/lib/nav/registry'

// Whether this person may use Projection yet: administrators while it is
// built (life areas first), everyone once it launches.
export const canUseProjection = (user: Pick<SignedInUser, 'role'> | null): user is SignedInUser =>
  user !== null && canOpen(getNode('projection'), user.role === 'ADMIN')
