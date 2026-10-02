import { Loader2 } from 'lucide-react'

import { getT } from '@/lib/i18n/server'

export default async function Loading() {
  const t = await getT()

  return (
    <main className="flex min-h-dvh items-center justify-center px-4" aria-busy="true">
      <p className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm font-medium shadow-sm">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        {t('Loading...')}
      </p>
    </main>
  )
}
