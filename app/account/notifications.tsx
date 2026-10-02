'use client'

import { useEffect, useState, useTransition } from 'react'
import { BellOff, BellRing, Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'

import { sendTestPushAction, subscribePushAction, unsubscribePushAction } from './actions'

// 'loading' until the browser has said whether this device is subscribed.
type Status = 'loading' | 'unsupported' | 'blocked' | 'off' | 'on'

// The key arrives as text; the browser wants it as bytes.
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }

  return bytes
}

// Some browsers never answer a subscription they will not allow. Waiting is
// cut short so the person gets an explanation instead of an endless spinner.
const SUBSCRIBE_TIMEOUT = 15_000

function withTimeout<Result>(task: Promise<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), SUBSCRIBE_TIMEOUT)

    task.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

// Brave blocks the push service of Chromium browsers until a setting is on.
const isBrave = () => 'brave' in navigator

const isSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// Turns notifications on or off for this device. `publicKey` is null when the
// app has no push keys, in which case nothing is offered.
export function NotificationSettings({ publicKey }: { publicKey: string | null }) {
  const t = useT()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    const check = async (): Promise<Status> => {
      if (!publicKey || !isSupported()) {
        return 'unsupported'
      }

      if (Notification.permission === 'denied') {
        return 'blocked'
      }

      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()

      return subscription ? 'on' : 'off'
    }

    check()
      .catch((): Status => 'unsupported')
      .then((next) => {
        if (!cancelled) {
          setStatus(next)
        }
      })

    return () => {
      cancelled = true
    }
  }, [publicKey])

  const turnOn = () =>
    startTransition(async () => {
      setMessage(null)

      try {
        const permission = await Notification.requestPermission()

        if (permission !== 'granted') {
          setStatus(permission === 'denied' ? 'blocked' : 'off')
          return
        }

        const registration = await navigator.serviceWorker.register('/sw.js')
        await withTimeout(navigator.serviceWorker.ready)
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await withTimeout(
            registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) }),
          ))
        const saved = await subscribePushAction(JSON.parse(JSON.stringify(subscription)))

        if (saved.error) {
          setMessage(saved.error)
          return
        }

        setStatus('on')
      } catch {
        setMessage(
          isBrave()
            ? t(
                'Brave blocks notifications until you allow them: open brave://settings/privacy, turn on "Use Google services for push messaging", then try again.',
              )
            : t('Notifications could not be turned on for this device.'),
        )
      }
    })

  const turnOff = () =>
    startTransition(async () => {
      setMessage(null)

      try {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager.getSubscription()

        if (subscription) {
          await unsubscribePushAction(subscription.endpoint)
          await subscription.unsubscribe()
        }

        setStatus('off')
      } catch {
        setMessage(t('Notifications could not be turned off. Try again.'))
      }
    })

  const sendTest = () =>
    startTransition(async () => {
      const result = await sendTestPushAction()
      setMessage(result.error ?? t('Sent. It should appear in a moment.'))
    })

  return (
    <div className="space-y-3">
      {status === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('Loading...')}
        </p>
      ) : status === 'unsupported' ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'This browser cannot receive notifications here. On an iPhone, first add the app to your home screen (Share, then "Add to Home Screen") and open it from there.',
          )}
        </p>
      ) : status === 'blocked' ? (
        <p className="text-sm text-muted-foreground">
          {t('Notifications are blocked for this site. Allow them in your browser settings, then come back.')}
        </p>
      ) : status === 'on' ? (
        <>
          <p className="flex items-center gap-2 text-sm">
            <BellRing className="size-4 text-success" aria-hidden="true" />
            {t('Notifications are on for this device.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={sendTest} className="h-11">
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {t('Send a test')}
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={turnOff} className="h-11 text-muted-foreground">
              <BellOff aria-hidden="true" />
              {t('Turn off')}
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" disabled={isPending} onClick={turnOn} className="h-11">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
          {t('Turn on notifications')}
        </Button>
      )}

      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}
