'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createProject, moveProject, updateProject } from '@/application/projects/projects'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseProjects } from './access'
import { moveForm, projectForm } from './schema'

// Projects show in Finance, Personal and Career too.
const refresh = () => revalidatePath('/', 'layout')

const dayOf = (value: string | undefined) => {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function saveProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)
  if (!canUseProjects(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }

  let createdId: string | null = null
  const state = await projectForm.submit(formData, async (form) => {
    const input = {
      name: form.name,
      summary: form.summary || null,
      kind: form.kind,
      primaryDomain: form.primaryDomain,
      lifeAreaId: form.lifeAreaId || null,
      startedAt: dayOf(form.startedAt),
    }
    const links = (form.links ?? []).map((l) => ({ label: l.label ?? '', url: l.url ?? '' }))
    if (form.id) await updateProject(user.id, form.id, input, links)
    else createdId = (await createProject(user.id, { ...input, status: form.planning ? 'PLANNING' : 'ACTIVE' }, links, now())).id
  })

  if (state.status !== 'success') return translateFormState(state, t)
  refresh()
  if (createdId) redirect(`/projects/${createdId}`)
  return translateFormState(state, t)
}

export async function moveProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)
  if (!canUseProjects(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }

  const state = await moveForm.submit(formData, (form) => moveProject(user.id, form.id, form.status, form.reason || null, now()))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}
