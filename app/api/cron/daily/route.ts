import { sendAssistantNotes } from '@/application/assistant/notes'
import { sendDailyReminders } from '@/application/notifications/dailyReminders'

// The assistant writes one note per person; give it time.
export const maxDuration = 300

// The daily job, called by the host's scheduler (see vercel.json). Anyone can
// reach this address, so it only runs for a caller that knows the secret,
// which the scheduler sends along.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // The notes first: whoever got one is not also reminded to record spending.
  const notes = await sendAssistantNotes()
  const reminders = await sendDailyReminders(undefined, notes.notified)

  return Response.json({ ...reminders, notes: notes.written })
}
