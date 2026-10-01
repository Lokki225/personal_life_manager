import { PrismaClient } from '../../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const connectionString = process.env.DATABASE_URL

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Opening a connection to the database costs far more than a query, so
    // idle ones are kept for five minutes instead of the default ten seconds.
    adapter: new PrismaPg({ connectionString: connectionString ?? '', idleTimeoutMillis: 300_000 }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
