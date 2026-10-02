import { sendDailyReminders } from '@/application/notifications/dailyReminders'

// The daily job, called by the host's scheduler (see vercel.json). Anyone can
// reach this address, so it only runs for a caller that knows the secret,
// which the scheduler sends along.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  return Response.json(await sendDailyReminders())
}
