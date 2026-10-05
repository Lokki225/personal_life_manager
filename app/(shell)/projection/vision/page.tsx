import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Telescope } from 'lucide-react'

import { AreaChip } from '@/components/life-areas/area-chip'
import { listLifeAreas } from '@/application/lifeAreas/areas'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { AreaActions, AreaDrawer } from './area-forms'

export const metadata: Metadata = {
  title: 'Vision | Personal Life Manager',
}

// Vision, first part (Projection spec §4, §9): the person's life areas. The
// overview of each area comes with the rest of Projection.
export default async function VisionPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)

  if (!user) {
    redirect('/login')
  }

  const areas = await listLifeAreas(user.id)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Vision')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('The parts of your life you invest in. Goals in every node can belong to one.')}</p>
        </div>
        <AreaDrawer />
      </header>

      {areas.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Telescope className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t('Name the parts of your life')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Tech, Music, Teaching, Health, Family: a few areas are enough. Each goal can serve one, so time and effort add up per area.')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {areas.map((area, index) => (
            <li key={area.id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <AreaChip area={area} className="text-sm" />
                  {area.statement ? <p className="text-sm whitespace-pre-wrap">{area.statement}</p> : null}
                  <p className="text-xs text-muted-foreground">{t.plural(area.goals, '{count} goal', '{count} goals')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <AreaDrawer area={area} />
                  <AreaActions id={area.id} first={index === 0} last={index === areas.length - 1} goals={area.goals} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
