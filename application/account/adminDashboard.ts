import {
  activeDays,
  activeUsersPerDay,
  activityStatus,
  latestOf,
  usageFunnel,
  type ActivityStatus,
} from '../../domain/account/activity'
import {
  userRepository,
  type UserRepository,
  type UserRole,
  type UserUsage,
} from '../../infrastructure/repositories/userRepository'
import { AccountRuleError } from './errors'

const CHART_DAYS = 30

type Deps = Pick<UserRepository, 'listUsers' | 'usageByUser' | 'entriesSince'>

const NO_USAGE: UserUsage = {
  expenses: 0,
  savings: 0,
  explanations: 0,
  goals: 0,
  debts: 0,
  ownChests: 0,
  incomeConfirmations: 0,
  lastEntryAt: null,
}

export type AdminUserRow = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
  role: UserRole
  createdAt: Date
  locale: string | null
  hasPlan: boolean
  // The latest of their last visit and their last entry.
  lastActiveAt: Date | null
  status: ActivityStatus
  // Days with at least one entry, out of the last 30.
  activeDays: number
  usage: UserUsage
}

// The features of the app, each with how to tell that someone used it.
const FEATURES = {
  expenses: (usage: UserUsage) => usage.expenses > 0,
  savings: (usage: UserUsage) => usage.savings > 0,
  ownChests: (usage: UserUsage) => usage.ownChests > 0,
  goals: (usage: UserUsage) => usage.goals > 0,
  debts: (usage: UserUsage) => usage.debts > 0,
  explanations: (usage: UserUsage) => usage.explanations > 0,
  incomeConfirmations: (usage: UserUsage) => usage.incomeConfirmations > 0,
} as const

export type FeatureKey = keyof typeof FEATURES

// Who uses the app and how, for an administrator. It holds counts and dates
// only: no amount and nothing a person typed.
export async function getAdminDashboard(
  actor: { role: UserRole },
  now: Date = new Date(),
  repository: Deps = userRepository,
) {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError('Only an administrator can do this.')
  }

  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (CHART_DAYS - 1))
  const [users, usageByUser, recentEntries] = await Promise.all([
    repository.listUsers(),
    repository.usageByUser(),
    repository.entriesSince(since),
  ])

  const rows: AdminUserRow[] = users.map((user) => {
    const usage = usageByUser.get(user.id) ?? NO_USAGE
    const lastActiveAt = latestOf(user.lastSeenAt, usage.lastEntryAt)

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      locale: user.locale,
      hasPlan: user.hasPlan,
      lastActiveAt,
      status: activityStatus(lastActiveAt, now),
      activeDays: activeDays(recentEntries.filter((entry) => entry.userId === user.id)),
      usage,
    }
  })

  const features = (Object.keys(FEATURES) as FeatureKey[]).map((key) => ({
    key,
    users: rows.filter((row) => FEATURES[key](row.usage)).length,
  }))

  return {
    users: rows,
    activeThisWeek: rows.filter((row) => row.status === 'active').length,
    funnel: usageFunnel(
      rows.map((row) => ({
        createdAt: row.createdAt,
        hasPlan: row.hasPlan,
        expenses: row.usage.expenses,
        lastEntryAt: row.usage.lastEntryAt,
      })),
    ),
    features,
    activePerDay: activeUsersPerDay(recentEntries, now, CHART_DAYS),
    languages: {
      fr: rows.filter((row) => row.locale === 'fr').length,
      en: rows.filter((row) => row.locale === 'en').length,
    },
  }
}

// Remembers that someone opened the app today, and in which language. Written
// at most once a day per person, or when their language changes.
export async function recordVisit(
  user: { id: string; lastSeenAt: Date | null; locale: string | null },
  locale: string,
  now: Date = new Date(),
  repository: Pick<UserRepository, 'recordVisit'> = userRepository,
): Promise<void> {
  const seenToday =
    user.lastSeenAt !== null &&
    user.lastSeenAt.getFullYear() === now.getFullYear() &&
    user.lastSeenAt.getMonth() === now.getMonth() &&
    user.lastSeenAt.getDate() === now.getDate()

  if (seenToday && user.locale === locale) {
    return
  }

  await repository.recordVisit(user.id, now, locale)
}
