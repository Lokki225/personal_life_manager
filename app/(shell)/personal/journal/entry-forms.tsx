'use client'

import { startTransition, useActionState, useRef, useState, useTransition, type FormEvent } from 'react'
import { CircleAlert, Link2, Loader2, Lock, LockOpen, Pencil, Plus, Trash2 } from 'lucide-react'

import { useIsOffline } from '@/components/offline/connection'
import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { linkToken, WRITABLE_TYPES, type LinkTarget } from '@/domain/personal/journal'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

import {
  deleteEntryAction,
  lockEntryAction,
  relockEntryAction,
  removeLockAction,
  saveDailyNoteAction,
  saveEntryAction,
  unlockEntryAction,
} from './actions'
import { ENTRY_TYPE_HINTS, ENTRY_TYPE_LABELS } from './entry-labels'

const scope = 'entry'

export type LinkOption = { targetType: LinkTarget; targetId: string; label: string }

export type EntryDraft = {
  id: string
  type: string
  title: string | null
  body: string
  mood: number | null
  energy: number | null
  // yyyy-mm-dd
  entryDate: string
  reviewOn: string | null
}

function Scale({ name, label, defaultValue }: { name: 'mood' | 'energy'; label: string; defaultValue: number | null }) {
  const t = useT()
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-6 gap-1">
        {['', '1', '2', '3', '4', '5'].map((value) => (
          <label key={value} className="cursor-pointer">
            <input type="radio" name={name} value={value} defaultChecked={String(defaultValue ?? '') === value} className="peer sr-only" />
            <span className="flex h-10 items-center justify-center rounded-md border border-input text-sm peer-checked:border-node-accent peer-checked:bg-node-accent peer-checked:text-on-node-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-node-accent/40">
              {value || t('–')}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function EntryFields({
  state,
  draft,
  links,
  today,
  initialBody = '',
  initialType = 'FREE',
}: {
  state: FormState
  draft: EntryDraft | null
  links: LinkOption[]
  today: string
  initialBody?: string
  initialType?: string
}) {
  const t = useT()
  const [type, setType] = useState(draft?.type ?? initialType)
  // A review is written from the review page; it keeps its kind when edited.
  const types: string[] = type === 'REVIEW' ? [...WRITABLE_TYPES, 'REVIEW'] : [...WRITABLE_TYPES]
  const [secure, setSecure] = useState(false)
  const body = useRef<HTMLTextAreaElement>(null)
  const id = (name: string) => `${scope}-${name}`

  // Puts a link to a goal or task where the cursor is.
  const insertLink = (value: string) => {
    const option = links.find((l) => `${l.targetType}:${l.targetId}` === value)
    const area = body.current
    if (!option || !area) return

    const token = linkToken(option)
    const start = area.selectionStart ?? area.value.length
    const end = area.selectionEnd ?? start
    const before = area.value.slice(0, start)
    const spaced = `${before && !/\s$/.test(before) ? ' ' : ''}${token} `
    area.value = before + spaced + area.value.slice(end)
    area.focus()
    area.setSelectionRange(start + spaced.length, start + spaced.length)
  }

  return (
    <>
      {draft ? <input type="hidden" name="id" value={draft.id} /> : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor={id('type')}>{t('Kind')}</Label>
          <NativeSelect id={id('type')} {...fieldAttributes(state, 'type', scope)} value={type} onChange={(e) => setType(e.target.value)} className={FIELD_CLASS}>
            {types.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {t(ENTRY_TYPE_LABELS[value as keyof typeof ENTRY_TYPE_LABELS])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id('entryDate')}>{t('Day')}</Label>
          <Input id={id('entryDate')} {...fieldAttributes(state, 'entryDate', scope)} type="date" defaultValue={draft?.entryDate ?? today} className={FIELD_CLASS} />
          <FieldError state={state} name="entryDate" scope={scope} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t(ENTRY_TYPE_HINTS[type as keyof typeof ENTRY_TYPE_HINTS] ?? '')}</p>

      <div className="grid gap-2">
        <Label htmlFor={id('title')}>{t('Title (optional)')}</Label>
        <Input id={id('title')} {...fieldAttributes(state, 'title', scope)} defaultValue={draft?.title ?? ''} maxLength={80} className={FIELD_CLASS} />
        <FieldError state={state} name="title" scope={scope} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id('body')}>{type === 'DECISION' ? t('What you decided, and why') : t('Entry')}</Label>
        <textarea
          id={id('body')}
          ref={body}
          {...fieldAttributes(state, 'body', scope)}
          defaultValue={draft?.body ?? initialBody}
          rows={7}
          maxLength={10_000}
          className="min-h-40 rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <FieldError state={state} name="body" scope={scope} />
        {links.length > 0 ? (
          <div className="flex items-center gap-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <NativeSelect
              aria-label={t('Link a goal or a task')}
              value=""
              onChange={(e) => insertLink(e.target.value)}
              className="h-10 text-sm"
            >
              <NativeSelectOption value="">{t('Link a goal or a task…')}</NativeSelectOption>
              {links.map((l) => (
                <NativeSelectOption key={`${l.targetType}:${l.targetId}`} value={`${l.targetType}:${l.targetId}`}>
                  {l.targetType === 'goal' ? t('Goal: {name}', { name: l.label }) : t('Task: {name}', { name: l.label })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>

      {type === 'DECISION' ? (
        <div className="grid gap-2">
          <Label htmlFor={id('reviewOn')}>{t('Look at it again on (optional)')}</Label>
          <Input id={id('reviewOn')} {...fieldAttributes(state, 'reviewOn', scope)} type="date" defaultValue={draft?.reviewOn ?? ''} className={FIELD_CLASS} />
          <FieldError state={state} name="reviewOn" scope={scope} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Scale name="mood" label={t('Mood')} defaultValue={draft?.mood ?? null} />
        <Scale name="energy" label={t('Energy')} defaultValue={draft?.energy ?? null} />
      </div>

      {draft ? null : (
        <div className="space-y-2 rounded-lg border p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="secure" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="size-5 accent-[var(--node-accent)]" />
            {t('Lock this entry with a password')}
          </label>
          {secure ? (
            <div className="grid gap-2">
              <Input {...fieldAttributes(state, 'password', scope)} type="password" autoComplete="new-password" aria-label={t('Password')} placeholder={t('Password')} className={FIELD_CLASS} />
              <FieldError state={state} name="password" scope={scope} />
              <p className="text-xs text-muted-foreground">{t('It keeps the entry from a glance, not from a determined reader. There is no way to recover it.')}</p>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

export function NewEntryDrawer({
  links,
  today,
  label,
  initialBody,
  initialType,
}: {
  links: LinkOption[]
  today: string
  label?: string
  // Text to start from, e.g. a link to the goal the entry is about.
  initialBody?: string
  initialType?: string
}) {
  const t = useT()
  return (
    <ActionDrawer
      title={t('New entry')}
      description={t('Write what happened and what you think about it.')}
      trigger={
        <Button className="h-11">
          <Plus aria-hidden="true" />
          {label ?? t('New entry')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={saveEntryAction} submitLabel={t('Save entry')} onDone={close}>
          {(state) => (
            <EntryFields state={state} draft={null} links={links} today={today} initialBody={initialBody} initialType={initialType} />
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function EditEntryDrawer({ draft, links, today }: { draft: EntryDraft; links: LinkOption[]; today: string }) {
  const t = useT()
  return (
    <ActionDrawer
      title={t('Edit entry')}
      description={t('Changes replace what was written.')}
      trigger={
        <Button variant="outline" className="h-11">
          <Pencil aria-hidden="true" />
          {t('Edit')}
        </Button>
      }
    >
      {(close) => (
        <ActionForm action={saveEntryAction} submitLabel={t('Save')} onDone={close}>
          {(state) => <EntryFields state={state} draft={draft} links={links} today={today} />}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

// A password form that stays on the page.
function PasswordForm({
  entryId,
  action,
  label,
  autoComplete,
}: {
  entryId: string
  action: (previous: FormState, formData: FormData) => Promise<FormState>
  label: string
  autoComplete: string
}) {
  const t = useT()
  const offline = useIsOffline()
  const [state, formAction, isPending] = useActionState(action, initialFormState)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={submit} className="space-y-1.5" noValidate>
      <input type="hidden" name="id" value={entryId} />
      <div className="flex gap-2">
        <Input {...fieldAttributes(state, 'password', `pw-${label}`)} type="password" autoComplete={autoComplete} aria-label={t('Password')} placeholder={t('Password')} className={FIELD_CLASS} />
        <Button type="submit" disabled={isPending || offline} className="h-12 shrink-0" title={offline ? t('This needs a connection.') : undefined}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {label}
        </Button>
      </div>
      <FieldError state={state} name="password" scope={`pw-${label}`} />
      {state.formErrors[0] ? <p className="text-sm text-destructive-strong">{state.formErrors[0]}</p> : null}
    </form>
  )
}

export function UnlockForm({ entryId }: { entryId: string }) {
  const t = useT()
  return <PasswordForm entryId={entryId} action={unlockEntryAction} label={t('Unlock')} autoComplete="current-password" />
}

// Lock an open entry, or take the lock off a locked one (which needs its password).
export function LockSettings({ entryId, isSecured }: { entryId: string; isSecured: boolean }) {
  const t = useT()
  const offline = useIsOffline()
  const [open, setOpen] = useState(false)
  const [pending, startPending] = useTransition()

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={offline} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {isSecured ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {isSecured ? t('Remove the lock') : t('Lock with a password')}
        </Button>
        {isSecured ? (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => startPending(() => relockEntryAction(entryId))}>
            <Lock aria-hidden="true" />
            {t('Close it now')}
          </Button>
        ) : null}
      </div>
      {open ? (
        isSecured ? (
          <PasswordForm entryId={entryId} action={removeLockAction} label={t('Remove')} autoComplete="current-password" />
        ) : (
          <PasswordForm entryId={entryId} action={lockEntryAction} label={t('Lock')} autoComplete="new-password" />
        )
      ) : null}
    </div>
  )
}

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const t = useT()
  const offline = useIsOffline()
  const [confirming, setConfirming] = useState(false)
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        disabled={pending || offline}
        className={cn('h-11', confirming ? 'border-destructive text-destructive-strong' : 'text-muted-foreground')}
        onClick={() => {
          if (!confirming) return setConfirming(true)
          startPending(async () => setError((await deleteEntryAction(entryId))?.error ?? null))
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
        {confirming ? t('Delete for good?') : t('Delete')}
      </Button>
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive-strong">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

// "One line about today", on Personal Today: today's daily note.
export function DailyLine({ body }: { body: string | null }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(saveDailyNoteAction, initialFormState)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={submit} className="space-y-1.5 rounded-xl border bg-card p-4" noValidate>
      <Label htmlFor="daily-line" className="font-semibold">
        {t('One line about today')}
      </Label>
      <div className="flex gap-2">
        <Input
          id="daily-line"
          {...fieldAttributes(state, 'body', 'daily')}
          defaultValue={body ?? ''}
          placeholder={t('How did it go?')}
          maxLength={500}
          className={FIELD_CLASS}
        />
        <Button type="submit" disabled={isPending} variant="outline" className="h-12 shrink-0">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {state.status === 'success' && !isPending ? t('Saved.') : t('Save')}
        </Button>
      </div>
      <FieldError state={state} name="body" scope="daily" />
      {state.formErrors[0] ? <p className="text-sm text-destructive-strong">{state.formErrors[0]}</p> : null}
    </form>
  )
}
