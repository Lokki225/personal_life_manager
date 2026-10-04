'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Flag, Loader2, Plus } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { HORIZONS, PRESETS, type Preset } from '@/domain/goals/presets'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { abandonGoalAction, addGoalTaskAction, addMilestoneAction, createGoalAction, logValueAction } from './actions'
import { HORIZON_LABELS, PRESET_HINTS, PRESET_LABELS } from './goal-labels'

const scope = 'goal'

type Option = { id: string; name: string }

function Field({
  state,
  name,
  label,
  hint,
  ...input
}: { state: FormState; name: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  const id = `${scope}-${name}`
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...fieldAttributes(state, name, scope)} className={FIELD_CLASS} {...input} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError state={state} name={name} scope={scope} />
    </div>
  )
}

function GoalFields({ state, categories, series }: { state: FormState; categories: Option[]; series: (Option & { unit: string | null })[] }) {
  const t = useT()
  const [preset, setPreset] = useState<Preset>('outcome')
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? 'new')
  const id = (name: string) => `${scope}-${name}`

  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t('Kind of goal')}</legend>
        {PRESETS.map((value) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name="preset"
              value={value}
              checked={preset === value}
              onChange={() => setPreset(value)}
              className="peer sr-only"
            />
            <span className="block rounded-lg border border-input px-3 py-2.5 transition-colors peer-checked:border-node-accent peer-checked:bg-node-accent/10 peer-focus-visible:ring-[3px] peer-focus-visible:ring-node-accent/40">
              <span className="block text-sm font-semibold">{t(PRESET_LABELS[value])}</span>
              <span className="block text-xs text-muted-foreground">{t(PRESET_HINTS[value])}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field state={state} name="name" label={t('Goal')} placeholder={t('Reach 1800 in rapid chess')} maxLength={60} />

      {preset === 'outcome' ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor={id('seriesId')}>{t('What you measure')}</Label>
            <NativeSelect id={id('seriesId')} {...fieldAttributes(state, 'seriesId', scope)} value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className={FIELD_CLASS}>
              {series.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="new">{t('Something new…')}</NativeSelectOption>
            </NativeSelect>
            <FieldError state={state} name="seriesId" scope={scope} />
          </div>
          {seriesId === 'new' ? (
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Field state={state} name="seriesLabel" label={t('Name')} placeholder={t('Chess rapid rating')} maxLength={40} />
              <Field state={state} name="seriesUnit" label={t('Unit (optional)')} placeholder="kg" maxLength={12} />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Field state={state} name="currentValue" label={t('Where you are now')} inputMode="decimal" placeholder="1543" />
            <Field state={state} name="target" label={t('Target')} inputMode="decimal" placeholder="1800" />
          </div>
        </>
      ) : null}

      {preset === 'accumulation' ? <Field state={state} name="target" label={t('Hours to put in')} inputMode="numeric" placeholder="150" /> : null}

      {preset === 'milestones' ? (
        <div className="grid gap-2">
          <Label htmlFor={id('milestones')}>{t('Steps, one per line')}</Label>
          <textarea
            id={id('milestones')}
            {...fieldAttributes(state, 'milestones', scope)}
            rows={4}
            placeholder={['Hiragana', 'Katakana', t('800 words'), 'JLPT N5'].join('\n')}
            className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <FieldError state={state} name="milestones" scope={scope} />
        </div>
      ) : null}

      {preset === 'habit' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field state={state} name="target" label={t('Times a week')} inputMode="numeric" placeholder="5" />
            <div className="grid gap-2">
              <Label htmlFor={id('counts')}>{t('Counted from')}</Label>
              <NativeSelect id={id('counts')} name="counts" defaultValue="sessions" className={FIELD_CLASS}>
                <NativeSelectOption value="sessions">{t('Sessions')}</NativeSelectOption>
                <NativeSelectOption value="tasks">{t('Ticked tasks')}</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field state={state} name="floor" label={t('Floor (optional)')} inputMode="numeric" placeholder="2" hint={t('Still a good week.')} />
            <Field state={state} name="stretch" label={t('Stretch (optional)')} inputMode="numeric" placeholder="7" />
          </div>
        </>
      ) : null}

      {preset === 'outcome' || preset === 'accumulation' || preset === 'milestones' ? (
        <Field
          state={state}
          name="weeklySessions"
          label={t('Sessions a week to keep pace (optional)')}
          inputMode="numeric"
          placeholder="4"
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor={id('horizon')}>{t('Horizon')}</Label>
          <NativeSelect id={id('horizon')} name="horizon" defaultValue="QUARTER" className={FIELD_CLASS}>
            {HORIZONS.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {t(HORIZON_LABELS[h])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {preset === 'habit' ? null : <Field state={state} name="deadline" label={t('By (optional)')} type="date" />}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id('categoryId')}>{t('Category (optional)')}</Label>
        <NativeSelect id={id('categoryId')} {...fieldAttributes(state, 'categoryId', scope)} defaultValue="" className={FIELD_CLASS}>
          <NativeSelectOption value="">{t('No category')}</NativeSelectOption>
          {categories.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {t(c.name)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </>
  )
}

export function NewGoalDrawer({ categories, series }: { categories: Option[]; series: (Option & { unit: string | null })[] }) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('New goal')}
      description={t('Pick what kind of goal it is; the app keeps track of it from your sessions, values and tasks.')}
      trigger={
        <Button className="h-11">
          <Plus aria-hidden="true" />
          {t('New goal')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={createGoalAction} submitLabel={t('Create goal')} onDone={close}>
          {(state) => <GoalFields state={state} categories={categories} series={series} />}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

// A small form that stays on the page and clears itself once saved.
function InlineForm({
  action,
  hidden,
  children,
  submitLabel,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>
  hidden: Record<string, string>
  children: (state: FormState) => React.ReactNode
  submitLabel: string
}) {
  const [formKey, setFormKey] = useState(0)
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const next = await action(previous, formData)
    if (next.status === 'success') setFormKey((key) => key + 1)
    return next
  }, initialFormState)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form key={formKey} onSubmit={submit} className="space-y-1.5" noValidate>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex gap-2">
        {children(state)}
        <Button type="submit" disabled={isPending} className="h-12 shrink-0 px-4" aria-label={submitLabel}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        </Button>
      </div>
      {state.formErrors[0] ? <p className="text-sm text-destructive-strong">{state.formErrors[0]}</p> : null}
    </form>
  )
}

export function AddMilestoneForm({ goalId }: { goalId: string }) {
  const t = useT()
  return (
    <InlineForm action={addMilestoneAction} hidden={{ goalId }} submitLabel={t('Add a step')}>
      {(state) => (
        <div className="min-w-0 flex-1 space-y-1">
          <Input {...fieldAttributes(state, 'name', 'step')} aria-label={t('Add a step')} placeholder={t('Add a step')} maxLength={60} className={FIELD_CLASS} />
          <FieldError state={state} name="name" scope="step" />
        </div>
      )}
    </InlineForm>
  )
}

export function GoalTaskForm({ goalId, milestones }: { goalId: string; milestones: Option[] }) {
  const t = useT()
  return (
    <InlineForm action={addGoalTaskAction} hidden={{ goalId }} submitLabel={t('Add a task')}>
      {(state) => (
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_9rem_8rem]">
          <div className="space-y-1">
            <Input {...fieldAttributes(state, 'title', 'goal-task')} aria-label={t('Add a task')} placeholder={t('Add a task')} maxLength={120} className={FIELD_CLASS} />
            <FieldError state={state} name="title" scope="goal-task" />
          </div>
          {milestones.length > 0 ? (
            <NativeSelect name="milestoneId" defaultValue="" aria-label={t('Step')} className={FIELD_CLASS}>
              <NativeSelectOption value="">{t('Whole goal')}</NativeSelectOption>
              {milestones.map((ms) => (
                <NativeSelectOption key={ms.id} value={ms.id}>
                  {ms.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}
          <NativeSelect name="when" defaultValue="inbox" aria-label={t('When')} className={FIELD_CLASS}>
            <NativeSelectOption value="inbox">{t('No date')}</NativeSelectOption>
            <NativeSelectOption value="today">{t('Today')}</NativeSelectOption>
            <NativeSelectOption value="tomorrow">{t('Tomorrow')}</NativeSelectOption>
          </NativeSelect>
        </div>
      )}
    </InlineForm>
  )
}

export function LogValueForm({ goalId, unit }: { goalId: string; unit: string | null }) {
  const t = useT()
  return (
    <InlineForm action={logValueAction} hidden={{ goalId }} submitLabel={t('Log a value')}>
      {(state) => (
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            {...fieldAttributes(state, 'value', 'value')}
            inputMode="decimal"
            aria-label={t('Log a value')}
            placeholder={unit ? t('Today’s value ({unit})', { unit }) : t('Today’s value')}
            className={FIELD_CLASS}
          />
          <FieldError state={state} name="value" scope="value" />
        </div>
      )}
    </InlineForm>
  )
}

export function AbandonDrawer({ goalId }: { goalId: string }) {
  const t = useT()

  return (
    <ActionDrawer
      title={t('Abandon this goal?')}
      description={t('It stays in your history. Saying why helps when you look back.')}
      trigger={
        <Button variant="outline" className="h-11 text-muted-foreground">
          <Flag aria-hidden="true" />
          {t('Abandon')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={abandonGoalAction} submitLabel={t('Abandon the goal')} onDone={close}>
          {(state) => (
            <>
              <input type="hidden" name="goalId" value={goalId} />
              <div className="grid gap-2">
                <Label htmlFor="abandon-reason">{t('Why (optional)')}</Label>
                <textarea
                  id="abandon-reason"
                  {...fieldAttributes(state, 'reason', 'abandon')}
                  rows={3}
                  maxLength={280}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <FieldError state={state} name="reason" scope="abandon" />
              </div>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}
