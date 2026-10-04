import bcrypt from 'bcryptjs'

import { prisma } from '../prisma/client'

export type UserRole = 'USER' | 'ADMIN'

// What a person can say about themselves. Only the two names are required.
export type ProfileData = {
  firstName: string
  lastName: string
  username: string | null
  bio: string | null
  occupation: string | null
  phone: string | null
  country: string | null
  city: string | null
  birthDate: Date | null
  // Where the person's days begin and end, e.g. "Africa/Abidjan".
  timeZone: string | null
}

export type UserProfile = { [Field in keyof ProfileData]: ProfileData[Field] | null } & {
  email: string
  picture: string | null
}

export type UserSummary = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
  role: UserRole
  createdAt: Date
  lastSeenAt: Date | null
  // The language the app was last shown in, e.g. "fr".
  locale: string | null
  // Whether the finance setup was completed.
  hasPlan: boolean
}

// How one person uses the app: how many of each thing they recorded, and when
// they last recorded anything. Counts and dates only.
export type UserUsage = {
  expenses: number
  savings: number
  explanations: number
  goals: number
  debts: number
  ownChests: number
  incomeConfirmations: number
  lastEntryAt: Date | null
}

export interface UserRepository {
  emailExists: (email: string) => Promise<boolean>
  // Stores the user with a hashed password. Resolves to null, without
  // writing, when the email is already taken.
  createUser: (
    email: string,
    password: string,
    names: { firstName: string; lastName: string; username: string | null; timeZone: string | null },
  ) => Promise<{ id: string; email: string } | null>
  // Sets the time zone of an account that has none. Leaves a chosen one alone.
  setTimeZoneIfMissing: (userId: string, timeZone: string) => Promise<void>
  getProfile: (userId: string) => Promise<UserProfile | null>
  // `picture` is left as it is when undefined, and removed when null.
  updateProfile: (userId: string, profile: ProfileData & { picture?: string | null }) => Promise<void>
  // Whether this is the person's current password.
  passwordMatches: (userId: string, password: string) => Promise<boolean>
  // Changes the email, the password, or both. Resolves to false, without
  // writing, when the email belongs to another account.
  updateCredentials: (userId: string, credentials: { email?: string; password?: string }) => Promise<boolean>
  listUsers: () => Promise<UserSummary[]>
  // Resolves to false when the user does not exist.
  setRole: (userId: string, role: UserRole) => Promise<boolean>
  recordVisit: (userId: string, at: Date, locale: string) => Promise<void>
  // Marks the days up to `through` as settled, only if they still stand at
  // `previous`. Resolves to false when someone else settled them first.
  claimSettlement: (userId: string, previous: Date | null, through: Date) => Promise<boolean>
  setBufferSweepDay: (userId: string, day: number) => Promise<void>
  // Everyone with a plan, with what closing their days needs.
  listPlanHolders: () => Promise<
    { id: string; timeZone: string | null; settledThrough: Date | null; bufferSweepDay: number }[]
  >
  // Usage per user id. A user who recorded nothing has no entry.
  usageByUser: () => Promise<Map<string, UserUsage>>
  // Who recorded something, and when, since a date.
  entriesSince: (since: Date) => Promise<{ userId: string; at: Date }[]>
}

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'

const EMPTY_USAGE: UserUsage = {
  expenses: 0,
  savings: 0,
  explanations: 0,
  goals: 0,
  debts: 0,
  ownChests: 0,
  incomeConfirmations: 0,
  lastEntryAt: null,
}

export const userRepository: UserRepository = {
  emailExists: async (email: string) => {
    return (await prisma.user.count({ where: { email } })) > 0
  },

  createUser: async (
    email: string,
    password: string,
    names: { firstName: string; lastName: string; username: string | null; timeZone: string | null },
  ) => {
    const passwordHash = await bcrypt.hash(password, 10)

    try {
      return await prisma.user.create({
        data: { email, passwordHash, ...names },
        select: { id: true, email: true },
      })
    } catch (error) {
      // Two sign-ups racing for the same email: the second one loses.
      if (isUniqueViolation(error)) {
        return null
      }

      throw error
    }
  },

  setTimeZoneIfMissing: async (userId: string, timeZone: string) => {
    await prisma.user.updateMany({ where: { id: userId, timeZone: null }, data: { timeZone } })
  },

  getProfile: async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        picture: true,
        firstName: true,
        lastName: true,
        username: true,
        bio: true,
        occupation: true,
        phone: true,
        country: true,
        city: true,
        birthDate: true,
        timeZone: true,
      },
    })
  },

  updateProfile: async (userId: string, profile: ProfileData & { picture?: string | null }) => {
    await prisma.user.update({ where: { id: userId }, data: profile })
  },

  passwordMatches: async (userId: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })

    return user !== null && (await bcrypt.compare(password, user.passwordHash))
  },

  updateCredentials: async (userId: string, credentials: { email?: string; password?: string }) => {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: credentials.email,
          passwordHash: credentials.password === undefined ? undefined : await bcrypt.hash(credentials.password, 10),
        },
      })

      return true
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false
      }

      throw error
    }
  },

  listUsers: async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
        locale: true,
        _count: { select: { incomes: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return users.map(({ _count, ...user }) => ({ ...user, hasPlan: _count.incomes > 0 }))
  },

  setRole: async (userId: string, role: UserRole) => {
    const { count } = await prisma.user.updateMany({ where: { id: userId }, data: { role } })

    return count > 0
  },

  recordVisit: async (userId: string, at: Date, locale: string) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt: at, locale } })
  },

  claimSettlement: async (userId: string, previous: Date | null, through: Date) => {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, settledThrough: previous },
      data: { settledThrough: through },
    })

    return count > 0
  },

  setBufferSweepDay: async (userId: string, day: number) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { bufferSweepDay: day } })
  },

  listPlanHolders: async () => {
    return prisma.user.findMany({
      where: { incomes: { some: {} } },
      select: { id: true, timeZone: true, settledThrough: true, bufferSweepDay: true },
    })
  },

  usageByUser: async () => {
    const [expenses, savings, explanations, goals, debts, ownChests, incomeConfirmations] = await Promise.all([
      prisma.expense.groupBy({ by: ['userId'], _count: { _all: true }, _max: { createdAt: true } }),
      prisma.moneyMovement.groupBy({
        by: ['userId'],
        where: { reason: 'DAILY_SAVING' },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.budgetException.groupBy({ by: ['userId'], _count: { _all: true }, _max: { createdAt: true } }),
      prisma.goal.groupBy({ by: ['userId'], _count: { _all: true }, _max: { createdAt: true } }),
      prisma.debt.groupBy({ by: ['userId'], _count: { _all: true }, _max: { createdAt: true } }),
      prisma.chest.groupBy({
        by: ['userId'],
        where: { isSystem: false },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.incomeReceipt.groupBy({ by: ['userId'], _count: { _all: true }, _max: { createdAt: true } }),
    ])

    type CountedRow = { userId: string; _count: { _all: number }; _max: { createdAt: Date | null } }

    const usage = new Map<string, UserUsage>()
    const add = (
      rows: CountedRow[],
      field: Exclude<keyof UserUsage, 'lastEntryAt'>,
      // Creating a chest is setting up, not day-to-day activity.
      countsAsEntry = true,
    ) => {
      for (const row of rows) {
        const entry = usage.get(row.userId) ?? { ...EMPTY_USAGE }
        const latest = row._max.createdAt

        entry[field] = row._count._all

        if (countsAsEntry && latest && (!entry.lastEntryAt || latest > entry.lastEntryAt)) {
          entry.lastEntryAt = latest
        }

        usage.set(row.userId, entry)
      }
    }

    add(expenses, 'expenses')
    add(savings, 'savings')
    add(explanations, 'explanations')
    add(goals, 'goals')
    add(debts, 'debts')
    add(ownChests, 'ownChests', false)
    add(incomeConfirmations, 'incomeConfirmations')

    return usage
  },

  entriesSince: async (since: Date) => {
    const where = { createdAt: { gte: since } }
    const select = { userId: true, createdAt: true }
    const tables = await Promise.all([
      prisma.expense.findMany({ where, select }),
      prisma.moneyMovement.findMany({ where, select }),
      prisma.budgetException.findMany({ where, select }),
      prisma.debt.findMany({ where, select }),
      prisma.goal.findMany({ where, select }),
    ])

    return tables.flat().map((row) => ({ userId: row.userId, at: row.createdAt }))
  },
}
