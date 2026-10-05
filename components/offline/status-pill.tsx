'use client'

import { CircleAlert, CloudOff, Loader2 } from 'lucide-react'
import { Popover } from 'radix-ui'

import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'
import { discard, retry } from '@/lib/offline/outbox'
import { cn } from '@/lib/utils'

import { useIsOffline } from './connection'
import { outboxItemLabel } from './outbox-item-label'
import { useOutbox } from './outbox-provider'

// The app bar's connection pill (offline spec §3): nothing when everything is
// sent; "Offline" without a connection; "Sending" while the outbox empties;
// "not sent" when the server refused something, with the list to act on.
export function StatusPill() {
  const t = useT()
  const offline = useIsOffline()
  const { items, sendNow } = useOutbox()
  const waiting = items.filter((item) => item.status !== 'rejected')
  const refused = items.filter((item) => item.status === 'rejected')

  if (!offline && waiting.length === 0 && refused.length === 0) {
    return null
  }

  const tone = refused.length > 0 || offline ? 'warning' : 'neutral'
  const label =
    refused.length > 0
      ? t.plural(refused.length, '{count} not sent', '{count} not sent')
      : offline
        ? waiting.length > 0
          ? t('Offline · {count} waiting', { count: waiting.length })
          : t('Offline')
        : t('Sending {count}…', { count: waiting.length })

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold outline-none focus-visible:ring-[3px]',
          tone === 'warning'
            ? 'border-warning/50 bg-warning/10 text-warning focus-visible:ring-warning/40'
            : 'border-border bg-card text-muted-foreground focus-visible:ring-node-accent/40',
        )}
        aria-label={t('Connection and sending: details')}
      >
        {refused.length > 0 ? (
          <CircleAlert className="size-4" aria-hidden="true" />
        ) : offline ? (
          <CloudOff className="size-4" aria-hidden="true" />
        ) : (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        )}
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 space-y-3 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-[var(--shadow-soft)]"
        >
          {offline ? (
            <div className="space-y-1">
              <p className="font-semibold">{t('You are offline')}</p>
              <p className="text-muted-foreground">
                {t('Expenses, savings, explanations and logged sessions are kept on this device and sent as soon as the connection is back, even if you close the app.')}
              </p>
              <p className="text-muted-foreground">{t('Actions that change your plan, move money between chests or need the server are paused.')}</p>
            </div>
          ) : null}

          {waiting.length > 0 ? (
            <div className="space-y-1">
              <p className="font-semibold">{t('Waiting to be sent')}</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {waiting.map((item) => (
                  <li key={item.id}>{outboxItemLabel(t, item)}</li>
                ))}
              </ul>
              {offline ? null : (
                <Button type="button" variant="outline" className="h-9" onClick={() => void sendNow()}>
                  {t('Send now')}
                </Button>
              )}
            </div>
          ) : null}

          {refused.length > 0 ? (
            <div className="space-y-2">
              <p className="font-semibold">{t('Not sent')}</p>
              <ul className="space-y-2">
                {refused.map((item) => (
                  <li key={item.id} className="rounded-lg border p-2">
                    <p>{outboxItemLabel(t, item)}</p>
                    <p className="text-xs text-destructive-strong">{item.error}</p>
                    <div className="mt-1.5 flex gap-2">
                      <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => void retry(item.id).then(sendNow)}>
                        {t('Try again')}
                      </Button>
                      <Button type="button" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => void discard(item.id)}>
                        {t('Discard')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
