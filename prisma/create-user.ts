// Creates a login, or resets its password, in the database DATABASE_URL points to.
// Usage: USER_EMAIL=you@example.com USER_PASSWORD='...' npm run db:create-user
import 'dotenv/config'
import bcrypt from 'bcryptjs'

async function main() {
  const email = process.env.USER_EMAIL?.trim().toLowerCase()
  const password = process.env.USER_PASSWORD

  if (!email || !password) {
    throw new Error('Set USER_EMAIL and USER_PASSWORD.')
  }

  if (password.length < 8) {
    throw new Error('USER_PASSWORD must be at least 8 characters.')
  }

  // Imported after dotenv has loaded, because the client reads DATABASE_URL on import.
  const { prisma } = await import('../infrastructure/prisma/client')

  const passwordHash = await bcrypt.hash(password, 10)
  const existing = await prisma.user.findUnique({ where: { email } })
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  })

  console.log(`${existing ? 'Password updated for' : 'Created user'} ${user.email}`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
