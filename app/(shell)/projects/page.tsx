import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, FolderKanban } from 'lucide-react'

import { AreaChip } from '@/components/life-areas/area-chip'
import { Badge } from '@/components/ui/badge'
import { listLifeAreas } from '@/application/lifeAreas/areas'
import { listProjects, type ProjectSummary } from '@/application/projects/projects'
import { PROJECT_DOMAINS, PROJECT_STATUSES, type ProjectStatus } from '@/domain/projects/projects'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import type { Translator } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { DOMAIN_LABELS, KIND_LABELS, momentumText, STATUS_LABELS } from './labels'
import { ProjectDrawer } from './project-forms'

export const metadata: Metadata = {
  title: 'Projects | Personal Life Manager',
}

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined)

function card(t: Translator, p: ProjectSummary, compact = false) {
  return (
    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-node-accent">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{p.name}</p>
          {compact ? null : <Badge variant="secondary">{t(STATUS_LABELS[p.status])}</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[t(KIND_LABELS[p.kind]), momentumText(t, p.momentum), p.hours > 0 ? t('{hours} h', { hours: p.hours }) : null].filter(Boolean).join(' · ')}
        </p>
        {p.lifeArea ? <AreaChip area={p.lifeArea} /> : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export default async function ProjectsPage({ searchParams }: PageProps<'/projects'>) {
  const [user, t, params] = await Promise.all([getSignedInUser(), getT(), searchParams])
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const [projects, areas] = await Promise.all([listProjects(user.id, clockNow()), listLifeAreas(user.id)])
  const board = one(params.view) === 'board'
  const domain = PROJECT_DOMAINS.find((d) => d === one(params.domain)) ?? null
  const area = areas.find((a) => a.id === one(params.area))?.id ?? null
  const status = PROJECT_STATUSES.find((s) => s === one(params.status)) ?? null

  const shown = projects.filter(
    (p) => (!domain || p.primaryDomain === domain) && (!area || p.lifeAreaId === area) && (!status || p.status === status),
  )
  // Archived ones last in the list; the board shows every status.
  const listed = [...shown.filter((p) => p.status !== 'ARCHIVED'), ...shown.filter((p) => p.status === 'ARCHIVED')]

  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams()
    const values = { view: board ? 'board' : null, domain, area, status, ...change }
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value)
    const query = next.toString()
    return query ? `/projects?${query}` : '/projects'
  }
  const chip = (active: boolean) =>
    cn(
      'flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors',
      active ? 'border-node-accent bg-node-accent text-on-node-accent' : 'bg-card text-muted-foreground hover:text-foreground',
    )

  return (
    <main className={cn('mx-auto w-full space-y-5 px-4 py-6 sm:px-6', board ? 'max-w-6xl' : 'max-w-2xl')}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Projects')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('Your bodies of work, from every part of the app.')}</p>
        </div>
        <ProjectDrawer areas={areas.map((a) => ({ id: a.id, name: a.name }))} />
      </header>

      <nav aria-label={t('Filters')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Link href={href({ view: null })} className={chip(!board)} aria-current={board ? undefined : 'page'}>
          {t('List')}
        </Link>
        <Link href={href({ view: 'board' })} className={chip(board)} aria-current={board ? 'page' : undefined}>
          {t('Board')}
        </Link>
        <span className="mx-1 w-px shrink-0 bg-border" aria-hidden="true" />
        {PROJECT_DOMAINS.map((d) => (
          <Link key={d} href={href({ domain: domain === d ? null : d })} className={chip(domain === d)}>
            {t(DOMAIN_LABELS[d])}
          </Link>
        ))}
        {areas.map((a) => (
          <Link key={a.id} href={href({ area: area === a.id ? null : a.id })} className={chip(area === a.id)}>
            {a.name}
          </Link>
        ))}
        {board
          ? null
          : (['ACTIVE', 'PAUSED', 'SHIPPED', 'ARCHIVED'] as ProjectStatus[]).map((s) => (
              <Link key={s} href={href({ status: status === s ? null : s })} className={chip(status === s)}>
                {t(STATUS_LABELS[s])}
              </Link>
            ))}
      </nav>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Name what you are building')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('An app, an album, a book, a training program: its status, time, money and momentum follow from what you already record.')}
          </p>
        </div>
      ) : board ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {PROJECT_STATUSES.map((s) => {
            const items = shown.filter((p) => p.status === s)
            return (
              <section key={s} className="w-64 shrink-0 space-y-2">
                <h2 className="text-sm font-semibold">
                  {t(STATUS_LABELS[s])} <span className="font-normal text-muted-foreground">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((p) => (
                    <li key={p.id}>{card(t, p, true)}</li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : listed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('No project matches these filters.')}</p>
      ) : (
        <ul className="space-y-2">
          {listed.map((p) => (
            <li key={p.id}>{card(t, p)}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
