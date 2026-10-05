'use client'

import { CloudOff } from 'lucide-react'
import { Popover } from 'radix-ui'

import { useT } from '@/lib/i18n/client'

import { useIsOffline } from './connection'

// Shown in the app bar while the connection is lost. Tapping it says what
// still works and what waits.
export function StatusPill() {
  const t = useT()
  const offline = useIsOffline()

  if (!offline) {
    return null
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 text-xs font-semibold text-warning outline-none focus-visible:ring-[3px] focus-visible:ring-warning/40"
        aria-label={t('Offline: what still works')}
      >
        <CloudOff className="size-4" aria-hidden="true" />
        {t('Offline')}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 space-y-2 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-[var(--shadow-soft)]"
        >
          <p className="font-semibold">{t('You are offline')}</p>
          <p className="text-muted-foreground">
            {t('What you send now waits on this page and goes as soon as the connection is back. Keep the page open until then.')}
          </p>
          <p className="text-muted-foreground">{t('Actions that change your plan, move money between chests or need the server are paused.')}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
