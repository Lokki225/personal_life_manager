'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, CircleAlert, Plus, Trash2 } from 'lucide-react'

import { ActionDrawer, ActionForm, FIELD_CLASS } from '@/components/forms/action-drawer'
import { AREA_COLOR_CLASSES, AREA_ICON_COMPONENTS } from '@/components/life-areas/area-chip'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { AREA_COLORS, AREA_ICONS } from '@/domain/lifeAreas/areas'
import { fieldAttributes } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

import { moveAreaAction, removeAreaAction, saveAreaAction, setGoalAreaAction } from './actions'

export type AreaValues = { id: string; name: string; statement: string | null; color: string | null; icon: string | null }

function useOneTap() {
  const [pending, startPending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const act = (action: () => Promise<{ error: string | null }>) => startPending(async () => setError((await action()).error))
  return { pending, error, act }
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="flex w-full items-center gap-1.5 text-xs text-destructive-strong">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null
}

export function AreaDrawer({ area }: { area?: AreaValues }) {
  const t = useT()
  const scope = area ? `area-${area.id}` : 'new-area'

  return (
    <ActionDrawer
      title={area ? t('Edit the area') : t('A life area')}
      description={t('A part of your life you want to invest in: Tech, Music, Family. Goals in every node can belong to one.')}
      trigger={
        area ? (
          <Button type="button" variant="ghost" className="h-9 text-xs">
            {t('Edit')}
          </Button>
        ) : (
          <Button type="button" className="h-11">
            <Plus aria-hidden="true" />
            {t('New area')}
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveAreaAction} submitLabel={area ? t('Save') : t('Add')} onDone={close}>
          {(state) => (
            <>
              {area ? <input type="hidden" name="id" value={area.id} /> : null}
              <div className="grid gap-2">
                <Label htmlFor={`${scope}-name`}>{t('Name')}</Label>
                <Input id={`${scope}-name`} {...fieldAttributes(state, 'name', scope)} defaultValue={area?.name} maxLength={40} className={FIELD_CLASS} />
                <FieldError state={state} name="name" scope={scope} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${scope}-statement`}>{t('In five years… (optional)')}</Label>
                <textarea
                  id={`${scope}-statement`}
                  {...fieldAttributes(state, 'statement', scope)}
                  defaultValue={area?.statement ?? ''}
                  maxLength={500}
                  rows={3}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <FieldError state={state} name="statement" scope={scope} />
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t('Colour')}</legend>
                <div className="flex flex-wrap gap-2">
                  {AREA_COLORS.map((color) => (
                    <label key={color} className="cursor-pointer">
                      <input type="radio" name="color" value={color} defaultChecked={area?.color === color} className="peer sr-only" />
                      <span className={cn('block size-8 rounded-full border-2 border-transparent peer-checked:border-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50', AREA_COLOR_CLASSES[color])} aria-label={color} />
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t('Icon')}</legend>
                <div className="flex flex-wrap gap-2">
                  {AREA_ICONS.map((icon) => {
                    const Icon = AREA_ICON_COMPONENTS[icon]
                    return (
                      <label key={icon} className="cursor-pointer">
                        <input type="radio" name="icon" value={icon} defaultChecked={area?.icon === icon} className="peer sr-only" />
                        <span className="flex size-9 items-center justify-center rounded-lg border border-input peer-checked:border-node-accent peer-checked:bg-node-accent/10 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                          <Icon className="size-4" aria-label={icon} />
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </>
          )}
        </ActionForm>
      )}
    </ActionDrawer>
  )
}

export function AreaActions({ id, first, last, goals }: { id: string; first: boolean; last: boolean; goals: number }) {
  const t = useT()
  const { pending, error, act } = useOneTap()

  return (
    <>
      <Button type="button" variant="ghost" className="size-9 p-0" disabled={pending || first} onClick={() => act(() => moveAreaAction(id, 'up'))} aria-label={t('Move up')}>
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" className="size-9 p-0" disabled={pending || last} onClick={() => act(() => moveAreaAction(id, 'down'))} aria-label={t('Move down')}>
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="size-9 p-0 text-muted-foreground"
        disabled={pending}
        aria-label={t('Delete')}
        onClick={() => {
          const question = goals > 0 ? t('Delete this area? Its goals stay, without an area.') : t('Delete this area?')
          if (window.confirm(question)) act(() => removeAreaAction(id))
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      <ErrorLine error={error} />
    </>
  )
}

// The area a goal serves, changed in place, from a goal page in any node.
export function GoalAreaSelect({ goalId, value, areas }: { goalId: string; value: string | null; areas: { id: string; name: string }[] }) {
  const t = useT()
  const { pending, error, act } = useOneTap()

  if (areas.length === 0) return null
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('Life area')}</span>
        <NativeSelect
          defaultValue={value ?? ''}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value || null
            act(() => setGoalAreaAction(goalId, next))
          }}
          className="h-9 text-sm"
        >
          <NativeSelectOption value="">{t('None')}</NativeSelectOption>
          {areas.map((area) => (
            <NativeSelectOption key={area.id} value={area.id}>
              {area.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <ErrorLine error={error} />
    </div>
  )
}
