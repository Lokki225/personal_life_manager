import { securityEventRepository, type SecurityEventRepository } from '@/infrastructure/repositories/securityEventRepository'
import type { UserRole } from '@/infrastructure/repositories/userRepository'

import { AccountRuleError } from './errors'

const WEEK = 7 * 24 * 60 * 60 * 1000

// What the administrator sees of the security log: how many of each kind this
// week, and the latest events.
export async function getSecurityLog(
  actor: { role: UserRole },
  now: Date = new Date(),
  repository: Pick<SecurityEventRepository, 'recent' | 'countsSince'> = securityEventRepository,
) {
  if (actor.role !== 'ADMIN') throw new AccountRuleError('Only an administrator can do this.')

  const [counts, recent] = await Promise.all([repository.countsSince(new Date(now.getTime() - WEEK)), repository.recent(30)])
  return { week: counts.sort((a, b) => b.count - a.count), recent }
}
