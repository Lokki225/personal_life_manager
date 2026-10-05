import { sendAssistantNotes } from '@/application/assistant/notes'
import { settleEveryone } from '@/application/finance/settleEveryone'
import { sendDailyReminders } from '@/application/notifications/dailyReminders'
import { syncAllConnectors } from '@/application/personal/sync'
import { notificationRepository } from '@/infrastructure/repositories/notificationRepository'
import { securityEventRepository } from '@/infrastructure/repositories/securityEventRepository'
import { syncReceiptRepository } from '@/infrastructure/repositories/syncReceiptRepository'

// The assistant writes one note per person; give it time.
export const maxDuration = 300

// What was sent is remembered this long, to never send it twice.
const KEEP_DAYS = 120

// The daily job, called by the host's scheduler (see vercel.json). Anyone can
// reach this address, so it only runs for a caller that knows the secret,
// which the scheduler sends along.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // First everyone's days are closed, so the reminders see what moved.
  const settled = await settleEveryone()
  // Then the notes: whoever got one is not also reminded to record spending.
  const notes = await sendAssistantNotes()
  const reminders = await sendDailyReminders(undefined, notes.notified)
  // Measures read from outside (chess.com ratings) catch up once a day.
  const synced = await syncAllConnectors()

  await notificationRepository.prune(new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000))
  // Outbox ids older than any device could still be resending.
  await syncReceiptRepository.prune(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
  // The security log keeps 90 days.
  await securityEventRepository.prune(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))

  return Response.json({ settled, ...reminders, notes: notes.written, synced })
}
