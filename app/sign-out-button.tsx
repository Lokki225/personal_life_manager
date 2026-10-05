'use client'

import { useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/client'
import { signOutAndClear } from '@/lib/offline/sign-out'

export function SignOutButton() {
  const t = useT()
  const [isPending, setIsPending] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        setIsPending(true)
        void signOutAndClear()
      }}
      className="h-11"
    >
      {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
      {t('Sign out')}
    </Button>
  )
}
