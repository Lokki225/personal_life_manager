'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'

import { createResetLinkAction } from './actions'

// Creates a reset link for one person and shows it, to copy and send to them
// by message. The link is shown this once: it cannot be read back later.
export function ResetLinkButton({ userId, name }: { userId: string; name: string }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ link?: string; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const create = () =>
    startTransition(async () => {
      setCopied(false)
      setResult(await createResetLinkAction(userId))
    })

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Copying can be refused by the browser; the link stays visible to select.
    }
  }

  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={create}
        className="-ml-2 h-11 text-muted-foreground"
        aria-label={t('Create a password reset link for {name}', { name })}
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
        {t('Password reset link')}
      </Button>

      {result?.error ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {result.error}
        </p>
      ) : null}

      {result?.link ? (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">
            {t('Send this link to {name}. It works once, for 24 hours, and will not be shown again.', { name })}
          </p>
          <p className="rounded-md border bg-card px-2 py-1.5 font-mono text-xs break-all select-all">{result.link}</p>
          <Button type="button" variant="outline" onClick={() => copy(result.link!)} className="h-11">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t('Copied') : t('Copy the link')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
