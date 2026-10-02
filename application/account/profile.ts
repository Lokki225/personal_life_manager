import { userRepository, type UserRepository, type UserRole } from '../../infrastructure/repositories/userRepository'
import { AccountRuleError } from './errors'

// A picture is kept in the database as a small image the browser shrank
// before sending: a JPEG, PNG or WebP data URL.
const PICTURE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/
export const MAX_PICTURE_LENGTH = 100_000

// `picture`: a new image, null to remove the current one, undefined to keep it.
export async function updateProfile(
  userId: string,
  profile: { username: string; picture?: string | null },
  repository: Pick<UserRepository, 'updateProfile'> = userRepository,
): Promise<void> {
  const { picture } = profile

  if (typeof picture === 'string' && (picture.length > MAX_PICTURE_LENGTH || !PICTURE_PATTERN.test(picture))) {
    throw new AccountRuleError('This picture could not be used. Try another one.', 'picture')
  }

  await repository.updateProfile(userId, { username: profile.username.trim(), picture })
}

type Actor = { id: string; role: UserRole }

const requireAdmin = (actor: Actor) => {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError('Only an administrator can do this.')
  }
}

export async function listUsersForAdmin(actor: Actor, repository: Pick<UserRepository, 'listUsers'> = userRepository) {
  requireAdmin(actor)

  return repository.listUsers()
}

// An administrator cannot change their own role, so there is always one left.
export async function changeUserRole(
  actor: Actor,
  userId: string,
  role: UserRole,
  repository: Pick<UserRepository, 'setRole'> = userRepository,
): Promise<void> {
  requireAdmin(actor)

  if (userId === actor.id) {
    throw new AccountRuleError('You cannot change your own role.')
  }

  if (!(await repository.setRole(userId, role))) {
    throw new AccountRuleError('This user no longer exists.')
  }
}
