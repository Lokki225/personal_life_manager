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
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Projects
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Project list</h1>
            </div>
            <Link
              href="/finance"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to overview
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create a project</h2>
          <form action={createProjectAction} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Project name
              <input
                name="name"
                placeholder="Travel, house, startup..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Notes
              <textarea
                name="notes"
                rows={3}
                placeholder="Purpose, timeline, or context"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>

            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Save project
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Existing projects</h2>

          {projects.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {projects.map((project) => (
                <li key={project.id} className="flex items-start justify-between gap-4 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-medium text-slate-800">{project.name}</p>
                    {project.notes ? <p className="mt-1 text-slate-600">{project.notes}</p> : null}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Project
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No projects created yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
