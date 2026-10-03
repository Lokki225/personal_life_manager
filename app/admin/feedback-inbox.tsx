'use client'

import { useState, useTransition } from 'react'
import { CheckCheck, Copy, Loader2, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'

import { markFeedbackReadAction } from '../feedback/actions'
import { KIND_LABELS } from '../feedback/kinds'

export type InboxItem = {
  id: string
  rating: number | null
  kind: string
  message: string
  date: string
  unread: boolean
  name: string
  email: string
}

// What people said about the app, newest first, for the administrators.
export function FeedbackInbox({
  items,
  unread,
  newsReaders,
}: {
  items: InboxItem[]
  unread: number
  newsReaders: { name: string; email: string }[]
}) {
  const t = useT()
  const [isPending, startMarking] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const markRead = () =>
    startMarking(async () => {
      const result = await markFeedbackReadAction()
      setError(result.error ?? null)
    })

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(newsReaders.map((reader) => reader.email).join(', '))
      setCopied(true)
    } catch {
      // Copying can be refused by the browser; the addresses stay visible.
    }
  }

  return (
    <div className="space-y-4">
      {unread > 0 ? (
        <Button type="button" variant="outline" disabled={isPending} onClick={markRead} className="h-11">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
          {t('Mark all as read')}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {error}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="stagger space-y-3">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {item.unread ? <Badge>{t('New')}</Badge> : null}
                <Badge variant="secondary">{t(KIND_LABELS[item.kind as keyof typeof KIND_LABELS] ?? KIND_LABELS.other)}</Badge>
                {item.rating ? (
                  <span className="flex items-center gap-0.5" aria-label={t.plural(item.rating, '{count} star', '{count} stars')}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={value <= item.rating! ? 'size-4 fill-warning text-warning' : 'size-4 text-muted-foreground/40'}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.message}</p>
              <p className="text-xs text-muted-foreground">
                {item.name} · {item.email} · {item.date}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('No opinions yet.')}</p>
      )}

      <details className="rounded-xl border bg-card px-4 py-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">
          {t.plural(newsReaders.length, '{count} person wants news', '{count} people want news')}
        </summary>
        {newsReaders.length > 0 ? (
          <div className="space-y-3 pb-3">
            <ul className="space-y-1 text-sm">
              {newsReaders.map((reader) => (
                <li key={reader.email} className="truncate">
                  {reader.name} · <span className="text-muted-foreground">{reader.email}</span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={copyEmails} className="h-11">
              <Copy aria-hidden="true" />
              {copied ? t('Copied') : t('Copy the addresses')}
            </Button>
          </div>
        ) : null}
      </details>
    </div>
  )
}
