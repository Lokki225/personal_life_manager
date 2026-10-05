import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BadgeCheck, CalendarClock, ExternalLink, IdCard } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { getSituation, type Situation } from '@/application/career/situation'
import { FACT_KINDS } from '@/domain/career/situation'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import type { Translator } from '@/lib/i18n/translate'

import { ARRANGEMENT_LABELS, CONTRACT_LABELS, isoDay, KIND_GROUP_LABELS, SOURCE_LABELS } from '../labels'
import {
  AddEvidenceDrawer,
  AddFactDrawer,
  DeleteEvidenceButton,
  EditFactDrawer,
  EndFactDrawer,
  FactQuickActions,
  LocationsForm,
  UnlinkButton,
  type FactValues,
} from './situation-forms'

export const metadata: Metadata = {
  title: 'Situation | Personal Life Manager',
}

type ShownFact = Situation['past'][number]

const values = (fact: ShownFact): FactValues => ({
  id: fact.id,
  kind: fact.kind,
  title: fact.title,
  details: fact.details,
  validFrom: isoDay(fact.validFrom),
  validTo: fact.validTo ? isoDay(fact.validTo) : null,
  confirmed: fact.source === 'CONFIRMED',
  organisation: fact.organisation,
  monthlyCompensation: fact.monthlyCompensation,
  workArrangement: fact.workArrangement,
  contractType: fact.contractType,
  weeklyHours: fact.weeklyHours,
  location: fact.location,
  issuer: fact.issuer,
  obtainedAt: fact.obtainedAt ? isoDay(fact.obtainedAt) : null,
  expiresAt: fact.expiresAt ? isoDay(fact.expiresAt) : null,
  level: fact.level,
  positionId: fact.positionId,
})

// One line of what a fact says beyond its title.
function factLine(t: Translator, fact: ShownFact) {
  const parts = [
    fact.organisation,
    fact.monthlyCompensation !== null ? `${t.amount(fact.monthlyCompensation)} ${CURRENCY_CODE} ${t('per month')}` : null,
    fact.workArrangement ? t(ARRANGEMENT_LABELS[fact.workArrangement] ?? fact.workArrangement) : null,
    fact.contractType ? t(CONTRACT_LABELS[fact.contractType] ?? fact.contractType) : null,
    fact.weeklyHours !== null ? t('{hours} h a week', { hours: fact.weeklyHours }) : null,
    fact.location,
    fact.issuer,
    fact.level,
  ]
  return parts.filter(Boolean).join(' · ')
}

export default async function CareerSituationPage({ searchParams }: PageProps<'/career/situation'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const situation = await getSituation(user.id, clockNow())
  const showHistory = params.history === '1'
  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const current = FACT_KINDS.flatMap((kind) => situation.byKind[kind])
  const all = [...current, ...situation.past]
  const titleOf = new Map(all.map((f) => [f.id, f.title]))
  const positions = all.filter((f) => f.kind === 'POSITION').map((f) => ({ id: f.id, title: f.title }))
  const evidenceById = new Map(situation.evidence.map((e) => [e.id, e]))

  const factCard = (fact: ShownFact) => {
    const primary = situation.primary?.fact.id === fact.id
    return (
      <li key={fact.id} className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{fact.title}</p>
            {factLine(t, fact) ? <p className="text-sm text-muted-foreground">{factLine(t, fact)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {primary ? <Badge>{t('Main position')}</Badge> : null}
            <Badge variant={fact.source === 'SELF' ? 'outline' : 'secondary'}>
              {fact.source !== 'SELF' ? <BadgeCheck aria-hidden="true" /> : null}
              {t(SOURCE_LABELS[fact.source])}
            </Badge>
            {fact.current && fact.reviewDue ? (
              <Badge variant="outline">
                <CalendarClock aria-hidden="true" />
                {t('Review due')}
              </Badge>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {fact.validTo
            ? t('From {from} to {to}', { from: date.format(fact.validFrom), to: date.format(fact.validTo) })
            : t('Since {date}', { date: date.format(fact.validFrom) })}
          {fact.lastReviewedAt ? ` · ${t('Reviewed {date}', { date: date.format(fact.lastReviewedAt) })}` : ''}
        </p>
        {fact.details ? <p className="text-sm whitespace-pre-wrap">{fact.details}</p> : null}
        {fact.evidenceIds.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {fact.evidenceIds.map((id) => {
              const evidence = evidenceById.get(id)
              return evidence ? (
                <li key={id}>
                  {evidence.url ? (
                    <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-node-accent hover:underline">
                      <ExternalLink className="size-3" aria-hidden="true" />
                      {evidence.title}
                    </a>
                  ) : (
                    <span className="text-xs">{evidence.title}</span>
                  )}
                </li>
              ) : null
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <EditFactDrawer fact={values(fact)} positions={positions} locations={situation.locations} />
          {fact.current ? <EndFactDrawer factId={fact.id} title={fact.title} /> : null}
          {fact.current ? <FactQuickActions factId={fact.id} reviewDue={fact.reviewDue} canBePrimary={fact.kind === 'POSITION' && !primary} /> : null}
        </div>
      </li>
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Situation')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('Where you stand today, fact by fact, and since when.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddEvidenceDrawer facts={current.map((f) => ({ id: f.id, title: f.title }))} />
          <AddFactDrawer positions={positions} locations={situation.locations} />
        </div>
      </header>

      {situation.primary?.chosen === 'latest' ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {t('You have several positions. Goals compare with {position}, the one you started last, until you choose your main one.', {
            position: situation.primary.fact.title,
          })}
        </p>
      ) : null}

      {current.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <IdCard className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Start with where you stand')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Your position, your qualifications, your skills and what you have done. Goals will be compared with them.')}
          </p>
        </div>
      ) : (
        FACT_KINDS.filter((kind) => situation.byKind[kind].length > 0).map((kind) => (
          <section key={kind} className="space-y-2">
            <h2 className="text-base font-semibold">{t(KIND_GROUP_LABELS[kind])}</h2>
            <ul className="space-y-2">{situation.byKind[kind].map(factCard)}</ul>
          </section>
        ))
      )}

      {situation.past.length > 0 ? (
        <section className="space-y-2">
          <Link href={showHistory ? '/career/situation' : '/career/situation?history=1'} className="text-sm text-node-accent hover:underline">
            {showHistory ? t('Hide the history') : t.plural(situation.past.length, 'Show the history ({count} fact)', 'Show the history ({count} facts)')}
          </Link>
          {showHistory ? <ul className="space-y-2 opacity-80">{situation.past.map(factCard)}</ul> : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('Evidence')}</h2>
        {situation.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('No evidence yet. A link makes a fact documented.')}</p>
        ) : (
          <ul className="space-y-2">
            {situation.evidence.map((evidence) => (
              <li key={evidence.id} className="space-y-1.5 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {evidence.url ? (
                    <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-node-accent hover:underline">
                      <ExternalLink className="size-4" aria-hidden="true" />
                      {evidence.title}
                    </a>
                  ) : (
                    <p className="font-medium">{evidence.title}</p>
                  )}
                  <DeleteEvidenceButton evidenceId={evidence.id} />
                </div>
                {evidence.description ? <p className="text-sm text-muted-foreground">{evidence.description}</p> : null}
                {evidence.factIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {evidence.factIds.map((factId) => (
                      <UnlinkButton key={factId} evidenceId={evidence.id} factId={factId} title={titleOf.get(factId) ?? '?'} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t('Places')}</h2>
        <p className="text-sm text-muted-foreground">{t('The places a goal can ask for, such as where you would like to work.')}</p>
        <LocationsForm places={situation.locations} />
      </section>
    </main>
  )
}
