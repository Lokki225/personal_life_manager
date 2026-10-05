'use client'

import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'

export function RetryButton() {
  const t = useT()

  return (
    <Button type="button" variant="outline" className="h-11" onClick={() => window.location.reload()}>
      <RefreshCw aria-hidden="true" />
      {t('Try again')}
    </Button>
  )
}
