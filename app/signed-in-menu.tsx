import { recordVisit } from '@/application/account/adminDashboard'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { displayNameFromEmail } from '@/lib/greeting'
import { getLocale } from '@/lib/i18n/server'

import { UserMenu } from './user-menu'

// The account menu for whoever is signed in, or nothing for a visitor.
export async function SignedInMenu() {
  const user = await getSignedInUser()

  if (!user) {
    return null
  }

  // This menu is on every signed-in page, so it is where a visit is noted.
  await recordVisit(user, await getLocale())

  return (
    <UserMenu
      user={{
        name: user.username || displayNameFromEmail(user.email) || user.email,
        email: user.email,
        picture: user.picture,
        isAdmin: user.role === 'ADMIN',
      }}
    />
  )
}
