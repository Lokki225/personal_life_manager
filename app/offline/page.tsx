import { CloudOff } from 'lucide-react'

import { getT } from '@/lib/i18n/server'

import { RetryButton } from './retry-button'

// Shown by the service worker when a page cannot be loaded without a
// connection. Kept on the device from the start.
export default async function OfflinePage() {
  const t = await getT()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudOff className="size-10 text-warning" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{t('You are offline')}</h1>
      <p className="text-muted-foreground">
        {t("This page hasn't been opened yet on this device. Connect to load it.")}
      </p>
      <RetryButton />
    </main>
  )
}
