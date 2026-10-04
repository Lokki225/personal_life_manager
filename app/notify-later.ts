import { after } from 'next/server'

// Sends a notification once the response is on its way, so the person never
// waits for it, and a failure to notify never fails what they did.
export function notifyLater(task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task()
    } catch (error) {
      console.error('A notification could not be sent:', error)
    }
  })
}
