import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'
import bcrypt from 'bcryptjs'

import { prisma } from '@/infrastructure/prisma/client'
import { clientIp } from '@/infrastructure/auth/request'
import { securityRepository } from '@/infrastructure/repositories/securityRepository'

// Wrong passwords allowed for one email before sign-in pauses for it.
const SIGN_IN_LIMIT = 10
const SIGN_IN_WINDOW = 15 * 60 * 1000
// From one network address, across every account it tries.
const SIGN_IN_IP_LIMIT = 30

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.trim().toLowerCase()
        const attempts = `signIn:${email}`
        const fromAddress = `signInIp:${await clientIp()}`

        // Guessing a password is slowed down: after too many wrong ones, even
        // the right one waits, per account and per network address. The
        // message name is read by the sign-in form.
        if (
          (await securityRepository.isLimited(attempts, SIGN_IN_LIMIT, SIGN_IN_WINDOW)) ||
          (await securityRepository.isLimited(fromAddress, SIGN_IN_IP_LIMIT, SIGN_IN_WINDOW))
        ) {
          throw new Error('TooManyAttempts')
        }

        const user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
          await Promise.all([securityRepository.recordAttempt(attempts), securityRepository.recordAttempt(fromAddress)])
          return null
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        )

        if (!isValidPassword) {
          await Promise.all([securityRepository.recordAttempt(attempts), securityRepository.recordAttempt(fromAddress)])
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.email,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      return token
    },
    async session({ session, token }) {
      const typedSessionUser = session.user as typeof session.user & {
        id?: string
      }

      // The account is known by its id only: an email can change.
      if (!typedSessionUser.id && typeof token.sub === 'string') {
        typedSessionUser.id = token.sub
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
