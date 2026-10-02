import webpush from 'web-push'

// Sends notifications to people's devices through the browsers' own push
// services. No third-party account: only a pair of keys the app owns.
//
// Needs three environment variables:
//   VAPID_PUBLIC_KEY   given to the browser when a device subscribes
//   VAPID_PRIVATE_KEY  signs what is sent, so it is accepted as coming from the app
//   VAPID_SUBJECT      a contact address, e.g. "mailto:you@example.com"

export type PushMessage = {
  title: string
  body: string
  // The page to open when the notification is tapped.
  url: string
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string }

export const pushPublicKey = (): string | null => process.env.VAPID_PUBLIC_KEY || null

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

// 'sent', or 'gone' when the device no longer accepts messages (uninstalled,
// permission withdrawn) and its subscription should be forgotten, or 'failed'
// for anything else. It never throws: one device must not stop the others.
export async function sendPush(target: PushTarget, message: PushMessage): Promise<'sent' | 'gone' | 'failed'> {
  if (!isPushConfigured()) {
    return 'failed'
  }

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT!,
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
        // A reminder about today is pointless tomorrow.
        TTL: 12 * 60 * 60,
      },
    )

    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode

    if (status === 404 || status === 410) {
      return 'gone'
    }

    console.error('Push not sent:', status ?? error)
    return 'failed'
  }
}
