'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { MAX_LINKS, PROJECT_DOMAINS, PROJECT_KINDS, PROJECT_STATUSES, type ProjectStatus } from '@/domain/projects/projects'
import { fieldAttributes, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { moveProjectAction, saveProjectAction } from './actions'
import { DOMAIN_LABELS, KIND_LABELS, STATUS_LABELS } from './labels'

export type ProjectValues = {
  id: string
  name: string
  summary: string | null
  kind: (typeof PROJECT_KINDS)[number]
  primaryDomain: string
  lifeAreaId: string | null
  startedAt: string | null
  links: { label: string; url: string }[]
}

type Option = { id: string; name: string }

function Field({ state, scope, name, label, children }: { state: FormState; scope: string; name: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${scope}-${name}`}>{label}</Label>
      {children}
      <FieldError state={state} name={name} scope={scope} />
    </div>
  )
}

export function ProjectDrawer({ project, areas }: { project?: ProjectValues; areas: Option[] }) {
  const t = useT()
  const scope = project ? `project-${project.id}` : 'new-project'
  const [rows, setRows] = useState(Math.max(project?.links.length ?? 0, 1))

  return (
    <ActionDrawer
      title={project ? t('Edit the project') : t('A new project')}
      description={t('A body of work that evolves: an app, an album, a book, a training program.')}
      trigger={
        project ? (
          <Button type="button" variant="ghost" className="h-10">
            {t('Edit')}
          </Button>
        ) : (
          <Button type="button" className="h-11">
            <Plus aria-hidden="true" />
            {t('New project')}
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveProjectAction} submitLabel={project ? t('Save') : t('Create')} onDone={close}>
          {(state) => (
            <>
              {project ? <input type="hidden" name="id" value={project.id} /> : null}
              <Field state={state} scope={scope} name="name" label={t('Name')}>
                <Input id={`${scope}-name`} {...fieldAttributes(state, 'name', scope)} defaultValue={project?.name} maxLength={80} className={FIELD_CLASS} />
              </Field>
              <Field state={state} scope={scope} name="summary" label={t('In one or two sentences (optional)')}>
                <textarea
                  id={`${scope}-summary`}
                  {...fieldAttributes(state, 'summary', scope)}
                  defaultValue={project?.summary ?? ''}
                  maxLength={300}
                  rows={2}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field state={state} scope={scope} name="kind" label={t('Kind')}>
                  <NativeSelect id={`${scope}-kind`} {...fieldAttributes(state, 'kind', scope)} defaultValue={project?.kind ?? 'SOFTWARE'} className={FIELD_CLASS}>
                    {PROJECT_KINDS.map((k) => (
                      <NativeSelectOption key={k} value={k}>
                        {t(KIND_LABELS[k])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field state={state} scope={scope} name="primaryDomain" label={t('Listed first in')}>
                  <NativeSelect id={`${scope}-primaryDomain`} {...fieldAttributes(state, 'primaryDomain', scope)} defaultValue={project?.primaryDomain ?? 'personal'} className={FIELD_CLASS}>
                    {PROJECT_DOMAINS.map((d) => (
                      <NativeSelectOption key={d} value={d}>
                        {t(DOMAIN_LABELS[d])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {areas.length > 0 ? (
                  <Field state={state} scope={scope} name="lifeAreaId" label={t('Life area (optional)')}>
                    <NativeSelect id={`${scope}-lifeAreaId`} {...fieldAttributes(state, 'lifeAreaId', scope)} defaultValue={project?.lifeAreaId ?? ''} className={FIELD_CLASS}>
                      <NativeSelectOption value="">{t('None')}</NativeSelectOption>
                      {areas.map((a) => (
                        <NativeSelectOption key={a.id} value={a.id}>
                          {a.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                ) : null}
                <Field state={state} scope={scope} name="startedAt" label={t('Started (optional)')}>
                  <Input id={`${scope}-startedAt`} {...fieldAttributes(state, 'startedAt', scope)} type="date" defaultValue={project?.startedAt ?? ''} className={FIELD_CLASS} />
                </Field>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t('Links (optional)')}</legend>
                {Array.from({ length: rows }, (_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                    <Input name={`links.${i}.label`} defaultValue={project?.links[i]?.label ?? ''} placeholder={t('Repository')} maxLength={40} aria-label={t('Label')} className="h-10" />
                    <Input name={`links.${i}.url`} type="url" defaultValue={project?.links[i]?.url ?? ''} placeholder="https://" maxLength={2000} aria-label={t('Link')} className="h-10" />
                  </div>
                ))}
                {rows < MAX_LINKS ? (
                  <Button type="button" variant="ghost" className="h-9 w-fit text-xs" onClick={() => setRows(rows + 1)}>
                    <Plus aria-hidden="true" />
                    {t('Another link')}
                  </Button>
                ) : null}
                <FieldError state={state} name="links" scope={scope} />
              </fieldset>
              {project ? null : (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="planning" className="size-4 accent-node-accent" />
                  {t('Not started yet: planning')}
                </label>
              )}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function MoveProjectDrawer({ id, status }: { id: string; status: ProjectStatus }) {
  const t = useT()
  const [next, setNext] = useState<ProjectStatus>(status === 'ACTIVE' ? 'SHIPPED' : 'ACTIVE')
  const scope = `move-${id}`

  return (
    <ActionDrawer
      title={t('Where it stands')}
      description={t('Moves go in any direction; each one is kept with its date.')}
      trigger={
        <Button type="button" variant="outline" className="h-10">
          {t('Change status')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={moveProjectAction} submitLabel={t('Save')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={id} />
              <Field state={state} scope={scope} name="status" label={t('Status')}>
                <NativeSelect id={`${scope}-status`} name="status" value={next} onChange={(e) => setNext(e.target.value as ProjectStatus)} className={FIELD_CLASS}>
                  {PROJECT_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {t(STATUS_LABELS[s])}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {next === 'ARCHIVED' ? (
                <Field state={state} scope={scope} name="reason" label={t('Why: a result, not a failure')}>
                  <textarea
                    id={`${scope}-reason`}
                    {...fieldAttributes(state, 'reason', scope)}
                    maxLength={280}
                    rows={2}
                    className="rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </Field>
              ) : null}
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
