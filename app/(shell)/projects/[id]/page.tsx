import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { AreaChip } from '@/components/life-areas/area-chip'
import { Badge } from '@/components/ui/badge'
import { listLifeAreas } from '@/application/lifeAreas/areas'
import { getProject } from '@/application/projects/projects'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { isoDay, KIND_LABELS, momentumText, STATUS_LABELS } from '../labels'
import { MoveProjectDrawer, ProjectDrawer } from '../project-forms'

export const metadata: Metadata = {
  title: 'Project | Personal Life Manager',
}

// Releases and goals arrive with the next step of the plan.
const TABS = [
  { id: 'overview', label: m('Overview') },
  { id: 'log', label: m('Log') },
  { id: 'time', label: m('Time') },
  { id: 'money', label: m('Money') },
] as const

type TabId = (typeof TABS)[number]['id']

export default async function ProjectPage({ params, searchParams }: PageProps<'/projects/[id]'>) {
  const [user, t, { id }, query] = await Promise.all([getSignedInUser(), getT(), params, searchParams])
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [project, areas] = await Promise.all([getProject(user.id, id, clockNow()), listLifeAreas(user.id)])

  if (!project) {
    notFound()
  }

  const tab: TabId = TABS.find((x) => x.id === query.tab)?.id ?? 'overview'
  const date = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const monthName = new Intl.DateTimeFormat(t.intl, { month: 'long', year: 'numeric' })
  const money = (amount: number) => `${t.amount(Math.round(amount))} ${CURRENCY_CODE}`
  const maxHours = Math.max(...project.weeks.map((w) => w.hours), 1)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <Link href="/projects" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('Projects')}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
          <Badge variant="secondary">{t(STATUS_LABELS[project.status])}</Badge>
          {project.lifeArea ? <AreaChip area={project.lifeArea} /> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {[
            t(KIND_LABELS[project.kind]),
            project.startedAt ? t('Since {date}', { date: date.format(project.startedAt) }) : null,
            momentumText(t, project.momentum),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {project.summary ? <p className="text-sm">{project.summary}</p> : null}
        {project.links.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {project.links.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-node-accent hover:underline">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <MoveProjectDrawer id={project.id} status={project.status} />
          <ProjectDrawer
            project={{
              id: project.id,
              name: project.name,
              summary: project.summary,
              kind: project.kind,
              primaryDomain: project.primaryDomain,
              lifeAreaId: project.lifeAreaId,
              startedAt: project.startedAt ? isoDay(project.startedAt) : null,
              links: project.links.map((l) => ({ label: l.label, url: l.url })),
            }}
            areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          />
        </div>
      </header>

      <nav aria-label={t('Project')} className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
        {TABS.map((x) => (
          <Link
            key={x.id}
            href={x.id === 'overview' ? `/projects/${project.id}` : `/projects/${project.id}?tab=${x.id}`}
            aria-current={tab === x.id ? 'page' : undefined}
            className={cn(
              '-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium',
              tab === x.id ? 'border-node-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(x.label)}
          </Link>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('Last 14 days')}</p>
            <p className="text-xl font-semibold">{t.plural(project.trend.recent, '{count} thing done', '{count} things done')}</p>
            <p className="text-xs text-muted-foreground">{t('{count} the 14 days before', { count: project.trend.previous })}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('Time')}</p>
            <p className="text-xl font-semibold">{t('{hours} h', { hours: project.hours })}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('Money, net')}</p>
            <p className="text-xl font-semibold">{money(project.money.net)}</p>
          </div>
          {project.goals.length > 0 ? (
            <div className="space-y-1 rounded-xl border bg-card p-4 sm:col-span-3">
              <p className="text-sm font-semibold">{t('Goals')}</p>
              <ul className="text-sm">
                {project.goals.map((g) => (
                  <li key={g.id}>
                    <Link href={g.domain === 'career' ? `/career/goals/${g.id}` : `/personal/goals/${g.id}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'log' ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('Status history')}</h2>
          <ol className="space-y-2">
            {project.statusChanges.map((change) => (
              <li key={change.id} className="rounded-xl border bg-card px-4 py-3 text-sm">
                <p className="flex justify-between gap-3">
                  <span className="font-medium">
                    {change.from ? `${t(STATUS_LABELS[change.from])} → ` : ''}
                    {t(STATUS_LABELS[change.to])}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{date.format(change.changedAt)}</span>
                </p>
                {change.reason ? <p className="mt-1 text-muted-foreground">{change.reason}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {tab === 'time' ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t('Hours per week')}</h2>
          {project.weeks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No session yet. Sessions linked to the project or to one of its goals count here, once each.')}</p>
          ) : (
            <>
              <div className="flex h-32 items-end gap-1" role="img" aria-label={t('{hours} h in all', { hours: project.hours })}>
                {project.weeks.slice(-26).map((w) => (
                  <div
                    key={w.week.toISOString()}
                    title={`${date.format(w.week)}: ${t('{hours} h', { hours: w.hours })}`}
                    className="min-w-1 flex-1 rounded-t bg-node-accent/70"
                    style={{ height: `${Math.max((w.hours / maxHours) * 100, w.hours > 0 ? 4 : 0)}%` }}
                  />
                ))}
              </div>
              <ul className="divide-y text-sm">
                {project.sessions.slice(0, 20).map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{[s.goal, s.note].filter(Boolean).join(' · ') || t('Session')}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {date.format(s.startedAt)} · {t('{minutes} min', { minutes: s.minutes })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {tab === 'money' ? (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('Spent')}</p>
              <p className="font-semibold">{money(project.money.spent)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('Earned')}</p>
              <p className="font-semibold">{money(project.money.earned)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('Net')}</p>
              <p className="font-semibold">{money(project.money.net)}</p>
            </div>
          </div>
          {project.money.months.length > 0 ? (
            <ul className="divide-y text-sm">
              {project.money.months.map((row) => (
                <li key={row.month.toISOString()} className="flex justify-between gap-3 py-2">
                  <span>{monthName.format(row.month)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    −{money(row.spent)} · +{money(row.earned)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('No expense or income linked to this project yet.')}</p>
          )}
          {project.finance.expenses.length > 0 ? (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">{t('Expenses')}</h2>
              <ul className="divide-y text-sm">
                {project.finance.expenses.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{e.description || t(e.category)}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {date.format(e.date)} · {money(e.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('Money stays private: it never appears on a public page.')}</p>
        </section>
      ) : null}
    </main>
  )
}
