import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createProjectAction } from '@/app/projects/actions'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const projects = await financeRepository.listProjects(userId)

  return (
    <main className="theme-shell px-4 py-6 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="bento-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="bento-label">Projects</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--text)]">Project list</h1>
            </div>
            <Link href="/finance" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
              Back to overview
            </Link>
          </div>
        </header>

        <section className="bento-card p-6">
          <h2 className="text-xl font-semibold text-[var(--text)]">Create a project</h2>
          <form action={createProjectAction} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-[var(--muted)]">
              Project name
              <input
                name="name"
                placeholder="Travel, house, startup..."
                className="bento-input mt-1"
                required
              />
            </label>

            <label className="block text-sm font-medium text-[var(--muted)]">
              Notes
              <textarea
                name="notes"
                rows={3}
                placeholder="Purpose, timeline, or context"
                className="bento-input mt-1"
              />
            </label>

            <button type="submit" className="bento-button-primary px-4 py-2.5 text-sm font-medium">
              Save project
            </button>
          </form>
        </section>

        <section className="bento-card p-6">
          <h2 className="text-xl font-semibold text-[var(--text)]">Existing projects</h2>

          {projects.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              {projects.map((project) => (
                <li key={project.id} className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-medium text-[var(--text)]">{project.name}</p>
                    {project.notes ? <p className="mt-1 text-[var(--muted)]">{project.notes}</p> : null}
                  </div>
                  <span className="rounded-full bg-[var(--panel-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                    Project
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No projects created yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
