import { redirect } from 'next/navigation'
import { Lock, LockOpen, PiggyBank } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ensureDefaultChests } from '@/application/finance/ensureDefaultChests'
import { listChestsForManagement } from '@/application/finance/deleteChest'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { DEBTS_CHEST_NAME } from '@/domain/finance/chests'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { Money } from '../money'
import { ConsolidateButton, DeleteChestButton, NewChestDrawer, TransferDrawer } from './chest-forms'
import { SweepDaySelect } from './sweep-day'
import { ensureDaysSettled } from '../settle'

export default async function ChestsPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  if (!userId) {
    redirect('/login')
  }

  // Accounts created before chests existed get their Base Chest and Buffer here.
  await ensureDefaultChests(userId)

  const chests = await listChestsForManagement(userId)
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const now = clockNow()
  // Borrowed money in the Debts Chest is not savings.
  const total = chests
    .filter((chest) => !(chest.isSystem && chest.name === DEBTS_CHEST_NAME))
    .reduce((sum, chest) => sum + Math.max(chest.balance, 0), 0)
  const buffer = chests.find((chest) => chest.isSystem && chest.name === 'Buffer')
  const options = chests.map((chest) => ({ id: chest.id, name: chest.name, balance: chest.balance }))

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Chests')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Money value={total} className="font-medium text-foreground" />{' '}
          {t.plural(chests.length, 'saved across {count} chest.', 'saved across {count} chests.')}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <NewChestDrawer />
        {chests.length > 1 ? <TransferDrawer chests={options} /> : null}
      </div>

      <SweepDaySelect day={user?.bufferSweepDay ?? 0} />

      {buffer && buffer.balance >= 1 ? <ConsolidateButton bufferBalance={Math.floor(buffer.balance)} /> : null}

      {chests.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {chests.map((chest) => {
            const isLocked = chest.type === 'SECURE' && chest.lockedUntil !== null && chest.lockedUntil > now

            return (
              <li key={chest.id}>
                <Card className="h-full gap-0 py-4">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium">
                        <span className="line-clamp-2">{t(chest.name)}</span>
                      </p>
                      <Badge variant={chest.type === 'SECURE' ? 'default' : 'secondary'} className="shrink-0">
                        {chest.type === 'SECURE' ? t('Secure') : t('Available')}
                      </Badge>
                    </div>
                    <p className={cn('text-2xl font-semibold tracking-tight', chest.balance < 0 && 'text-destructive-strong')}>
                      <Money value={chest.balance} />
                    </p>
                    <p className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground">
                      {isLocked ? (
                        <>
                          <Lock className="size-3.5" aria-hidden="true" />
                          {t('Locked until {date}', { date: dateFormatter.format(chest.lockedUntil!) })}
                        </>
                      ) : chest.type === 'SECURE' ? (
                        <>
                          <LockOpen className="size-3.5" aria-hidden="true" />
                          {t('Not locked')}
                        </>
                      ) : chest.isSystem ? (
                        t('Built-in chest')
                      ) : null}
                    </p>
                    {chest.deletionBlocker === null ? (
                      <div className="flex justify-end">
                        <DeleteChestButton chestId={chest.id} chestName={chest.name} />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <PiggyBank className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t('No chests yet')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('Create one to start putting money aside.')}</p>
        </div>
      )}
    </main>
  )
}
