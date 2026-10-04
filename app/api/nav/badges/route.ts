import { getBadges } from '@/application/nav/badges'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { canOpen, getNode } from '@/lib/nav/registry'

// The live lines of the life graph, for whoever is signed in.
export async function GET() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const isAdmin = user.role === 'ADMIN'
  const badges = await getBadges(user.id, (id) => canOpen(getNode(id), isAdmin), t, now())

  return Response.json(badges, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
