import { PrismaClient } from '../../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// The driver already treats "require" as full certificate verification, and
// warns that a future version will not. Asking for it by name keeps today's
// behaviour and silences the warning.
const connectionString = process.env.DATABASE_URL?.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/, '$1verify-full')

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Opening a connection to the database costs far more than a query, so
    // idle ones are kept for five minutes instead of the default ten seconds.
    adapter: new PrismaPg({ connectionString: connectionString ?? '', idleTimeoutMillis: 300_000 }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
