'use client'

import type { ComponentProps, ReactNode } from 'react'

import { FIELD_CLASS } from '@/components/forms/action-drawer'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldAttributes, type FormState } from '@/lib/forms/formState'

// Form fields shared by the Career forms.

// The journal's text area, in a smaller size.
export function Textarea(props: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className="rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  )
}

export function Field({ state, name, label, scope, children }: { state: FormState; name: string; label: string; scope: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${scope}-${name}`}>{label}</Label>
      {children}
      <FieldError state={state} name={name} scope={scope} />
    </div>
  )
}

export function TextField({
  state,
  scope,
  name,
  label,
  defaultValue,
  type = 'text',
  maxLength,
  inputMode,
  list,
}: {
  state: FormState
  scope: string
  name: string
  label: string
  defaultValue?: string | number | null
  type?: string
  maxLength?: number
  inputMode?: 'numeric'
  list?: string
}) {
  return (
    <Field state={state} name={name} label={label} scope={scope}>
      <Input
        id={`${scope}-${name}`}
        {...fieldAttributes(state, name, scope)}
        type={type}
        defaultValue={defaultValue ?? ''}
        maxLength={maxLength}
        inputMode={inputMode}
        list={list}
        className={FIELD_CLASS}
      />
    </Field>
  )
}

