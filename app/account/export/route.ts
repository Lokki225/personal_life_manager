import { exportUserData } from '@/application/account/exportData'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'

// Everything the signed-in person recorded, as one file they can keep.
export async function GET() {
  const userId = await getSignedInUserId()

  if (!userId) {
    return new Response('Sign in to export your data.', { status: 401 })
  }

  const data = await exportUserData(userId)
  const day = new Date().toISOString().slice(0, 10)

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="personal-life-manager-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
