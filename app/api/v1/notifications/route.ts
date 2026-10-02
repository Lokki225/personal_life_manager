import { z } from 'zod'

import { notifyDevices } from '@/application/notifications/notify'
import { pushRepository } from '@/infrastructure/repositories/pushRepository'

import { endpoint, ok, readBody } from '../api'

const notification = z.object(
  {
    title: z.string({ error: 'Give a "title".' }).trim().min(1, 'Give a "title".').max(80, 'Keep the title under 80 characters.'),
    body: z.string({ error: 'Give a "body".' }).trim().min(1, 'Give a "body".').max(300, 'Keep the body under 300 characters.'),
    // The page of the app to open when it is tapped.
    url: z
      .string()
      .trim()
      .regex(/^\/(?!\/)\S*$/, 'Give "url" as a path inside the app, for example "/finance/review".')
      .max(200)
      .optional(),
  },
  { error: 'Send the notification as a JSON object.' },
)

// Sends a notification to the devices of the owner of the key: a reminder, a
// summary, a word of encouragement. `delivered` is how many devices got it;
// 0 means the person has not turned notifications on anywhere.
export const POST = endpoint('WRITE', async (request, user) => {
  const { title, body, url } = await readBody(request, notification)
  const devices = await pushRepository.listSubscriptions(user.id)
  const delivered = await notifyDevices(devices, { title, body, url: url ?? '/finance' })

  return ok({ delivered, devices: devices.length }, 201)
})
