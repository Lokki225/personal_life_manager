import { createHash, randomBytes } from 'node:crypto'

import { prisma } from '../prisma/client'

export type ApiScope = 'READ' | 'WRITE'

export type ApiTokenSummary = {
  id: string
  name: string
  scope: ApiScope
  lastUsedAt: Date | null
  createdAt: Date
}

// Who a key belongs to, as far as answering a request needs to know.
export type ApiTokenOwner = {
  tokenId: string
  scope: ApiScope
  lastUsedAt: Date | null
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    username: string | null
    locale: string | null
    timeZone: string | null
    settledThrough: Date | null
    bufferSweepDay: number
  }
}

// Recognisable at a glance, and by tools that scan for leaked secrets.
export const API_TOKEN_PREFIX = 'plm_'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export interface ApiTokenRepository {
  // Creates a key and gives it back. Only its hash is stored, so it cannot be
  // read again later.
  createToken: (userId: string, name: string, scope: ApiScope) => Promise<string>
  listTokens: (userId: string) => Promise<ApiTokenSummary[]>
  countTokens: (userId: string) => Promise<number>
  // Resolves to false when the key is not one of the user's.
  deleteToken: (userId: string, id: string) => Promise<boolean>
  findOwner: (token: string) => Promise<ApiTokenOwner | null>
  markUsed: (tokenId: string, at: Date) => Promise<void>
}

export const apiTokenRepository: ApiTokenRepository = {
  createToken: async (userId: string, name: string, scope: ApiScope) => {
    const token = API_TOKEN_PREFIX + randomBytes(32).toString('base64url')

    await prisma.apiToken.create({ data: { userId, name, scope, tokenHash: hashToken(token) } })

    return token
  },

  listTokens: async (userId: string) => {
    return prisma.apiToken.findMany({
      where: { userId },
      select: { id: true, name: true, scope: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  countTokens: async (userId: string) => {
    return prisma.apiToken.count({ where: { userId } })
  },

  deleteToken: async (userId: string, id: string) => {
    const { count } = await prisma.apiToken.deleteMany({ where: { id, userId } })

    return count > 0
  },

  findOwner: async (token: string) => {
    const found = await prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        scope: true,
        lastUsedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            locale: true,
            timeZone: true,
            settledThrough: true,
            bufferSweepDay: true,
          },
        },
      },
    })

    return found ? { tokenId: found.id, scope: found.scope, lastUsedAt: found.lastUsedAt, user: found.user } : null
  },

  markUsed: async (tokenId: string, at: Date) => {
    await prisma.apiToken.updateMany({ where: { id: tokenId }, data: { lastUsedAt: at } })
  },
}
