import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { getOpportunity } from '@/application/career/opportunities'
import { careerRepository } from '@/infrastructure/repositories/careerRepository'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

import { JudgeDrawer } from '../../goals/goal-forms'
import { criterionText, summaryLines, valueText } from '../../goals/goal-text'
import { ARRANGEMENT_LABELS, CONTRACT_LABELS, isoDay, OPPORTUNITY_KIND_LABELS, OPPORTUNITY_STATUS_LABELS, OUTCOME_LABELS, RESULT_LABELS } from '../../labels'
import { AcceptOfferDrawer, DeleteOpportunityButton, LinkGoalsDrawer, MoveDrawer, OpportunityDrawer } from '../opportunity-forms'

export const metadata: Metadata = {
  title: 'Opportunity | Personal Life Manager',
}

export default async function CareerOpportunityPage({ params }: PageProps<'/career/opportunities/[id]'>) {
  const [user, t, { id }] = await Promise.all([getSignedInUser(), getT(), params])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [o, places] = await Promise.all([getOpportunity(user.id, id, clockNow()), careerRepository.getLocations(user.id)])

  if (!o) {
    notFound()
  }

  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const terms = [
    o.monthlyCompensation !== null ? `${t.amount(o.monthlyCompensation)} ${CURRENCY_CODE} ${t('per month')}` : null,
    o.workArrangement ? t(ARRANGEMENT_LABELS[o.workArrangement] ?? o.workArrangement) : null,
    o.contractType ? t(CONTRACT_LABELS[o.contractType] ?? o.contractType) : null,
    o.weeklyHours !== null ? t('{hours} h a week', { hours: o.weeklyHours }) : null,
    o.location,
  ].filter(Boolean)
  const statusLabel = (status: keyof typeof OPPORTUNITY_STATUS_LABELS, outcome: string | null) =>
    status === 'CLOSED' && outcome ? `${t(OPPORTUNITY_STATUS_LABELS.CLOSED)} · ${t(OUTCOME_LABELS[outcome] ?? outcome)}` : t(OPPORTUNITY_STATUS_LABELS[status])

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link href="/career/opportunities" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('Opportunities')}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{o.title}</h1>
          <Badge variant="secondary">{statusLabel(o.status, o.outcome)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {[o.organisation, t(OPPORTUNITY_KIND_LABELS[o.kind]), o.deadline ? t('Deadline {date}', { date: date.format(o.deadline) }) : null].filter(Boolean).join(' · ')}
        </p>
        {o.sourceUrl ? (
          <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-node-accent hover:underline">
            <ExternalLink className="size-4" aria-hidden="true" />
            {t('The posting')}
          </a>
        ) : null}
        <p className="text-sm">{terms.length > 0 ? terms.join(' · ') : t('No terms yet.')}</p>
        {o.notes ? <p className="text-sm whitespace-pre-wrap text-muted-foreground">{o.notes}</p> : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {o.status !== 'CLOSED' ? <AcceptOfferDrawer id={o.id} title={o.title} currentPosition={o.currentPosition} incomes={o.incomes} /> : null}
        <MoveDrawer id={o.id} status={o.status} />
        <LinkGoalsDrawer id={o.id} goals={o.allGoals} />
        <OpportunityDrawer
          opportunity={{
            id: o.id,
            title: o.title,
            organisation: o.organisation,
            kind: o.kind,
            sourceUrl: o.sourceUrl,
            notes: o.notes,
            deadline: o.deadline ? isoDay(o.deadline) : null,
            monthlyCompensation: o.monthlyCompensation,
            workArrangement: o.workArrangement,
            contractType: o.contractType,
            weeklyHours: o.weeklyHours,
            location: o.location,
          }}
          goals={[]}
          places={places}
        />
        <DeleteOpportunityButton id={o.id} />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('Compared with your goals')}</h2>
        {o.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('Not compared with any goal yet. Choose goals to see where this one stands.')}</p>
        ) : (
          o.goals.map((goal) => (
            <div key={goal.id} className="space-y-2 rounded-xl border bg-card p-4">
              <Link href={`/career/goals/${goal.id}`} className="font-medium hover:underline">
                {goal.name}
              </Link>
              {summaryLines(t, goal.summary).map((line) => (
                <p key={line} className="text-sm text-muted-foreground">
                  {line}
                </p>
              ))}
              <ul className="divide-y">
                {goal.criteria.map(({ result, criterion }) => (
                  <li key={result.condition.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      {criterionText(t, criterion)}
                      {valueText(t, criterion, result) ? <span className="text-muted-foreground"> · {valueText(t, criterion, result)}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn('font-semibold', result.satisfied ? 'text-success' : result.result === 'UNKNOWN' ? 'text-muted-foreground' : '')}>
                        {t(RESULT_LABELS[result.result])}
                      </span>
                      {criterion?.kind === 'judgement' ? (
                        <JudgeDrawer conditionId={result.condition.id} label={`${criterionText(t, criterion)} · ${o.title}`} again={result.asOf !== null} opportunityId={o.id} />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('History')}</h2>
        <ol className="space-y-1 text-sm">
          {o.statusChanges.map((change) => (
            <li key={change.id} className="flex justify-between gap-3">
              <span>{statusLabel(change.status, change.outcome)}</span>
              <span className="text-muted-foreground tabular-nums">{date.format(change.changedAt)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
