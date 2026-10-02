// Makes an account an administrator, or a normal user again, in the database
// DATABASE_URL points to. The first administrator has to be named this way;
// after that, administrators can change roles from the app.
// Usage: USER_EMAIL=you@example.com USER_ROLE=ADMIN npm run db:set-role
import 'dotenv/config'

async function main() {
  const email = process.env.USER_EMAIL?.trim().toLowerCase()
  const role = (process.env.USER_ROLE ?? 'ADMIN').trim().toUpperCase()

  if (!email) {
    throw new Error('Set USER_EMAIL.')
  }

  if (role !== 'ADMIN' && role !== 'USER') {
    throw new Error('USER_ROLE must be ADMIN or USER.')
  }

  // Imported after dotenv has loaded, because the client reads DATABASE_URL on import.
  const { prisma } = await import('../infrastructure/prisma/client')

  const { count } = await prisma.user.updateMany({ where: { email }, data: { role } })

  console.log(count > 0 ? `${email} is now ${role}` : `No account found for ${email}`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
