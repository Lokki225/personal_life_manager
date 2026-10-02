import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, FolderKanban, Save } from 'lucide-react'

import { createProjectAction } from '@/app/projects/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'
import { getT } from '@/lib/i18n/server'

import { SignedInMenu } from '../signed-in-menu'

// 44px touch targets and 16px text on phones (avoids iOS zoom on focus).
const FIELD_CLASS = 'h-11 text-base sm:text-sm'

export default async function ProjectsPage() {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    redirect('/login')
  }

  const projects = await financeRepository.listProjects(userId)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <SignedInMenu />
      {/* Right padding keeps the title clear of the account and theme buttons */}
      <header className="pr-28">
        <Link
          href="/finance"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('Finance')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t('Projects')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {projects.length > 0
            ? t.plural(projects.length, '{count} project.', '{count} projects.')
            : t('Group income and expenses around what you are building.')}
        </p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent>
          <h2 className="text-base font-semibold">{t('New project')}</h2>
          <form action={createProjectAction} className="mt-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">{t('Name')}</Label>
              <Input
                id="project-name"
                name="name"
                placeholder={t('Travel, house, startup...')}
                maxLength={80}
                required
                className={FIELD_CLASS}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-notes">{t('Notes (optional)')}</Label>
              <Input
                id="project-notes"
                name="notes"
                placeholder={t('Purpose, timeline, or context')}
                maxLength={200}
                className={FIELD_CLASS}
              />
            </div>
            <Button type="submit" className="h-11 w-full sm:w-auto sm:px-6">
              <Save aria-hidden="true" />
              {t('Save project')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {projects.length > 0 ? (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="gap-0 py-4">
                <CardContent className="flex items-start justify-between gap-3 px-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="line-clamp-2">{project.name}</span>
                    </p>
                    {project.notes ? <p className="mt-1 text-sm text-muted-foreground">{project.notes}</p> : null}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {t('Project')}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t('No projects yet')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Create one above to start grouping what belongs together.')}
          </p>
        </div>
      )}
    </main>
  )
}
