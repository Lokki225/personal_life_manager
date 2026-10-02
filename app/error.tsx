'use client'

import Link from 'next/link'
import { RotateCw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'

export default function GlobalError({
  reset,
}: {
  reset: () => void
}) {
  const t = useT()

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <TriangleAlert className="mx-auto size-8 text-warning" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t('Something went wrong')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('This page could not be loaded. Your data is safe. Try again in a moment.')}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => reset()} className="h-11">
            <RotateCw aria-hidden="true" />
            {t('Try again')}
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/">{t('Back to home')}</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
