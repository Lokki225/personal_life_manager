import { redirect } from 'next/navigation'
import { HandCoins } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { goalChestId, listDebtsWithStatus, listGoalsForDebts } from '@/application/finance/debts'
import { ensureDefaultChests } from '@/application/finance/ensureDefaultChests'
import { getChestsWithBalances } from '@/application/finance/getChestsWithBalances'
import { DEBTS_CHEST_NAME, isDebtChest } from '@/domain/finance/chests'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { Meter, Money } from '../money'
import { NewDebtDrawer, RepayDrawer } from './debt-forms'
import { ensureDaysSettled } from '../settle'

export default async function DebtsPage() {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  if (!userId) {
    redirect('/login')
  }

  // Borrowed money lands in the Debts Chest, so it must exist.
  await ensureDefaultChests(userId)

  const [debts, chests, goals] = await Promise.all([
    listDebtsWithStatus(userId),
    getChestsWithBalances(userId),
    listGoalsForDebts(userId),
  ])
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const dateTimeFormatter = new Intl.DateTimeFormat(t.intl, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  // Only a goal with its own chest can receive borrowed money.
  const goalOptions = goals.filter(goalChestId).map((goal) => ({ id: goal.id, name: goal.name }))
  const now = new Date()
  // Loans and repayments only come out of the Buffer, Base Chest or Debts Chest.
  const options = chests
    .filter(isDebtChest)
    .map((chest) => ({ id: chest.id, name: chest.name, balance: chest.balance }))
  const debtsChestBalance = options.find((chest) => chest.name === DEBTS_CHEST_NAME)?.balance ?? 0
  const outstandingOf = (direction: 'BORROWED' | 'LENT') =>
    debts.filter((debt) => debt.direction === direction).reduce((sum, debt) => sum + debt.outstanding, 0)
  // What is still open first, then the settled ones.
  const ordered = [...debts].sort((left, right) => Number(left.outstanding <= 0) - Number(right.outstanding <= 0))

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Debts and loans')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('You owe')} <Money value={outstandingOf('BORROWED')} className="font-medium text-foreground" />{' '}
          {t('and are owed')} <Money value={outstandingOf('LENT')} className="font-medium text-foreground" />.
        </p>
      </header>

      <Card className="gap-0 py-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('In your Debts Chest')}</p>
            <p className="text-2xl font-semibold tracking-tight">
              <Money value={debtsChestBalance} />
            </p>
          </div>
          <NewDebtDrawer chests={options} goals={goalOptions} />
        </CardContent>
      </Card>

      {ordered.length > 0 ? (
        <ul className="space-y-3">
          {ordered.map((debt) => {
            const borrowed = debt.direction === 'BORROWED'
            const settled = debt.outstanding <= 0
            const late = !settled && debt.dueDate !== null && debt.dueDate < now
            const dueDate = debt.dueDate ? dateFormatter.format(debt.dueDate) : null

            return (
              <li key={debt.id}>
                <Card className="gap-0 py-4">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="line-clamp-2">
                            <Money value={debt.principal} />{' '}
                            {borrowed
                              ? t('from {name}', { name: debt.counterparty })
                              : t('to {name}', { name: debt.counterparty })}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dateTimeFormatter.format(debt.takenAt)}
                          {debt.goal ? ` · ${t('For {goal}', { goal: debt.goal.name })}` : null}
                        </p>
                      </div>
                      <Badge variant={settled ? 'secondary' : 'default'} className="shrink-0">
                        {settled ? t('Settled') : borrowed ? t('You owe') : t('Owes you')}
                      </Badge>
                    </div>
                    <p className="text-2xl font-semibold tracking-tight">
                      <Money value={debt.outstanding} />
                      <span className="ml-2 text-sm font-normal text-muted-foreground">{t('left')}</span>
                    </p>
                    <Meter
                      value={debt.total > 0 ? (debt.paid / debt.total) * 100 : 0}
                      tone={settled ? 'success' : 'primary'}
                      label={t('Share of the debt with {name} repaid', { name: debt.counterparty })}
                    />
                    <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
                      <span>
                        <Money value={debt.paid} className="font-medium text-foreground" /> {t('of')}{' '}
                        <Money value={debt.total} />
                        {debt.total > debt.principal ? (
                          <>
                            {' '}
                            (<Money value={debt.total - debt.principal} /> {t('interest')})
                          </>
                        ) : null}
                      </span>
                      <span className={cn(late && 'font-medium text-destructive-strong')}>
                        {dueDate
                          ? late
                            ? t('Was due {date}', { date: dueDate })
                            : borrowed
                              ? t('To repay by {date}', { date: dueDate })
                              : t('Due {date}', { date: dueDate })
                          : t('No due date')}
                      </span>
                    </p>
                    {settled ? null : (
                      <div className="flex justify-end">
                        <RepayDrawer
                          debt={{
                            id: debt.id,
                            direction: debt.direction,
                            counterparty: debt.counterparty,
                            outstanding: debt.outstanding,
                          }}
                          chests={options}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <HandCoins className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t('No debts or loans')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Record money you borrowed or lent to keep track of it.')}
          </p>
        </div>
      )}
    </main>
  )
}
