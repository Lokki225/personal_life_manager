import { Hourglass } from 'lucide-react'

import { getT } from '@/lib/i18n/server'

// A view that is planned but not built yet, in any node.
export async function ComingLater({ title, text }: { title: string; text: string }) {
  const t = await getT()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(title)}</h1>
      <div className="rounded-xl border border-dashed p-8 text-center">
        <Hourglass className="mx-auto size-8 text-node-accent" aria-hidden="true" />
        <p className="mt-3 font-medium">{t('Coming soon')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t(text)}</p>
      </div>
    </main>
  )
}
