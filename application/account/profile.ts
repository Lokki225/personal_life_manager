import {
  userRepository,
  type ProfileData,
  type UserRepository,
  type UserRole,
} from '../../infrastructure/repositories/userRepository'
import { AccountRuleError } from './errors'

// A picture is kept in the database as a small image the browser shrank
// before sending: a JPEG, PNG or WebP data URL.
const PICTURE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/
export const MAX_PICTURE_LENGTH = 100_000

const OLDEST_BIRTH_YEAR = 1900

const optional = (value: string | null | undefined) => value?.trim() || null

export type ProfileInput = {
  firstName: string
  lastName: string
  username?: string | null
  bio?: string | null
  occupation?: string | null
  phone?: string | null
  country?: string | null
  city?: string | null
  birthDate?: Date | null
  // A new image, null to remove the current one, undefined to keep it.
  picture?: string | null
}

// Saves what a person says about themselves. Empty optional fields are
// stored as nothing, not as empty text.
export async function updateProfile(
  userId: string,
  profile: ProfileInput,
  repository: Pick<UserRepository, 'updateProfile'> = userRepository,
  today: Date = new Date(),
): Promise<void> {
  const { picture, birthDate = null } = profile

  if (typeof picture === 'string' && (picture.length > MAX_PICTURE_LENGTH || !PICTURE_PATTERN.test(picture))) {
    throw new AccountRuleError('This picture could not be used. Try another one.', 'picture')
  }

  if (birthDate && (birthDate > today || birthDate.getFullYear() < OLDEST_BIRTH_YEAR)) {
    throw new AccountRuleError('Enter a real date of birth.', 'birthDate')
  }

  const data: ProfileData = {
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
    username: optional(profile.username),
    bio: optional(profile.bio),
    occupation: optional(profile.occupation),
    phone: optional(profile.phone),
    country: optional(profile.country),
    city: optional(profile.city),
    birthDate,
  }

  await repository.updateProfile(userId, { ...data, picture })
}

// Changes the email, the password, or both. The current password is asked
// first, so a phone left unlocked is not enough to take over the account.
export async function changeCredentials(
  userId: string,
  input: { currentPassword: string; email: string; newPassword?: string | null },
  repository: Pick<UserRepository, 'passwordMatches' | 'updateCredentials'> = userRepository,
): Promise<void> {
  if (!(await repository.passwordMatches(userId, input.currentPassword))) {
    throw new AccountRuleError('This is not your current password.', 'currentPassword')
  }

  const saved = await repository.updateCredentials(userId, {
    email: input.email.trim().toLowerCase(),
    password: input.newPassword || undefined,
  })

  if (!saved) {
    throw new AccountRuleError('Another account already uses this email.', 'email')
  }
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
