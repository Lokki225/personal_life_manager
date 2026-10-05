import { userRepository, type UserRepository, type UserRole } from '@/infrastructure/repositories/userRepository'

import { AccountRuleError } from './errors'

// Deletes the account and everything recorded in it, for good. The password is
// asked first, so a phone left unlocked is not enough. The last administrator
// cannot leave: someone has to keep the role.
export async function deleteAccount(
  user: { id: string; role: UserRole },
  password: string,
  repository: Pick<UserRepository, 'passwordMatches' | 'countAdmins' | 'deleteAccount'> = userRepository,
): Promise<void> {
  if (!(await repository.passwordMatches(user.id, password))) {
    throw new AccountRuleError('This is not your current password.', 'password')
  }

  if (user.role === 'ADMIN' && (await repository.countAdmins()) <= 1) {
    throw new AccountRuleError('You are the only administrator. Give the role to someone else first.')
  }

  await repository.deleteAccount(user.id)
}
