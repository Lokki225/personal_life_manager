import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, DoorOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { listCareerGoals } from '@/application/career/goals'
import { listOpportunities, type OpportunitySummary } from '@/application/career/opportunities'
import { careerRepository } from '@/infrastructure/repositories/careerRepository'
import { OPPORTUNITY_STATUSES } from '@/domain/career/opportunities'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import type { Translator } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { OPPORTUNITY_KIND_LABELS, OPPORTUNITY_STATUS_LABELS, OUTCOME_LABELS } from '../labels'
import { OpportunityDrawer } from './opportunity-forms'

export const metadata: Metadata = {
  title: 'Opportunities | Personal Life Manager',
}

function card(t: Translator, o: OpportunitySummary, date: Intl.DateTimeFormat, compact = false) {
  const status = o.status === 'CLOSED' && o.outcome ? `${t(OPPORTUNITY_STATUS_LABELS.CLOSED)} · ${t(OUTCOME_LABELS[o.outcome] ?? o.outcome)}` : t(OPPORTUNITY_STATUS_LABELS[o.status])
  return (
    <Link href={`/career/opportunities/${o.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-node-accent">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium">{o.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[o.organisation, t(OPPORTUNITY_KIND_LABELS[o.kind]), o.monthlyCompensation !== null ? `${t.amount(o.monthlyCompensation)} ${CURRENCY_CODE}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {compact ? null : <Badge variant="secondary">{status}</Badge>}
          {o.deadline && o.status !== 'CLOSED' ? <span className="text-xs text-muted-foreground">{t('Deadline {date}', { date: date.format(o.deadline) })}</span> : null}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export default async function CareerOpportunitiesPage({ searchParams }: PageProps<'/career/opportunities'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [opportunities, goals, places] = await Promise.all([listOpportunities(user.id), listCareerGoals(user.id, clockNow()), careerRepository.getLocations(user.id)])
  const pipeline = params.view === 'pipeline'
  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short' })
  const tab = (active: boolean) =>
    cn(
      'flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
      active ? 'border-node-accent bg-node-accent text-on-node-accent' : 'bg-card text-muted-foreground hover:text-foreground',
    )

  return (
    <main className={cn('mx-auto w-full space-y-5 px-4 py-6 sm:px-6', pipeline ? 'max-w-6xl' : 'max-w-2xl')}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Opportunities')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('Openings and offers, compared with what you want.')}</p>
        </div>
        <OpportunityDrawer goals={goals.filter((g) => !g.abandonedAt && !g.supersededAt).map((g) => ({ id: g.id, name: g.name }))} places={places} />
      </header>

      <nav aria-label={t('View')} className="flex gap-2">
        <Link href="/career/opportunities" aria-current={pipeline ? undefined : 'page'} className={tab(!pipeline)}>
          {t('List')}
        </Link>
        <Link href="/career/opportunities?view=pipeline" aria-current={pipeline ? 'page' : undefined} className={tab(pipeline)}>
          {t('Pipeline')}
        </Link>
      </nav>

      {opportunities.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <DoorOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Note the openings you see')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('A job, a promotion, a freelance contract, a training: each one is compared with your goals.')}</p>
        </div>
      ) : pipeline ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {OPPORTUNITY_STATUSES.map((status) => {
            const items = opportunities.filter((o) => o.status === status)
            return (
              <section key={status} className="w-64 shrink-0 space-y-2">
                <h2 className="text-sm font-semibold">
                  {t(OPPORTUNITY_STATUS_LABELS[status])} <span className="font-normal text-muted-foreground">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((o) => (
                    <li key={o.id}>{card(t, o, date, true)}</li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {opportunities.map((o) => (
            <li key={o.id}>{card(t, o, date)}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
