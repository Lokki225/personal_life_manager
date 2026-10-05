'use client'

import {
  startTransition,
  useActionState,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Check, CircleAlert, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { Avatar } from '../avatar'
import { changeCredentialsAction, updateProfileAction } from './actions'
import { REMOVE_PICTURE } from './schema'

const PICTURE_SIZE = 160
// 44px touch targets and 16px text on phones (avoids iOS zoom on focus).
const FIELD_CLASS = 'h-11 text-base sm:text-sm'

// Crops the image to a centred square and shrinks it, so what is stored is a
// few kilobytes whatever the photo's size.
async function toSmallPicture(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = PICTURE_SIZE
  canvas.height = PICTURE_SIZE

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('No canvas')
  }

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PICTURE_SIZE,
    PICTURE_SIZE,
  )

  return canvas.toDataURL('image/jpeg', 0.85)
}

// Dispatching by hand keeps what was typed when the server returns an error.
function useForm(action: (previous: FormState, formData: FormData) => Promise<FormState>) {
  const [state, formAction, isPending] = useActionState(action, initialFormState)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return { state, isPending, onSubmit }
}

function FormFooter({ state, isPending }: { state: FormState; isPending: boolean }) {
  const t = useT()

  return (
    <>
      {state.formErrors.length > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending} className="h-11 px-6">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {isPending ? t('Saving...') : t('Save')}
        </Button>
        {state.status === 'success' && !isPending ? (
          <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check className="size-4 text-success" aria-hidden="true" />
            {t('Saved.')}
          </p>
        ) : null}
      </div>
    </>
  )
}

function Field({
  state,
  name,
  label,
  hint,
  className,
  children,
}: {
  state: FormState
  name: string
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`grid content-start gap-2 ${className ?? ''}`}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError state={state} name={name} />
    </div>
  )
}

export type ProfileValues = {
  firstName: string
  lastName: string
  username: string
  bio: string
  occupation: string
  phone: string
  country: string
  city: string
  // "1998-05-12", or empty.
  birthDate: string
  timeZone: string
  picture: string | null
}

// The list of time zones is the browser's, so it is only known once the page
// runs there. Until then the saved zone is the one choice.
const noZones: string[] = []
const subscribeToNothing = () => () => {}
let browserZones: string[] | null = null
const readBrowserZones = () => (browserZones ??= Intl.supportedValuesOf('timeZone'))
const readNoZones = () => noZones

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const t = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile.firstName)
  // What will be saved: a new image, REMOVE_PICTURE, or '' to keep the current one.
  const [pictureChange, setPictureChange] = useState('')
  const [pictureError, setPictureError] = useState<string | null>(null)
  const { state, isPending, onSubmit } = useForm(updateProfileAction)

  const zones = useSyncExternalStore(subscribeToNothing, readBrowserZones, readNoZones)
  const zoneChoices = profile.timeZone && !zones.includes(profile.timeZone) ? [profile.timeZone, ...zones] : zones

  const shownPicture = pictureChange === REMOVE_PICTURE ? null : pictureChange || profile.picture
  const optional = (label: string) => `${label} (${t('optional')})`

  const choosePicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      setPictureChange(await toSmallPicture(file))
      setPictureError(null)
    } catch {
      setPictureError(t('This picture could not be used. Try another one.'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="picture" value={pictureChange} />

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={firstName} picture={shownPicture} className="size-20 text-2xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={choosePicture}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="h-11">
            <ImagePlus aria-hidden="true" />
            {shownPicture ? t('Change picture') : t('Add a picture')}
          </Button>
          {shownPicture ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPictureChange(REMOVE_PICTURE)}
              className="h-11 text-muted-foreground"
            >
              <Trash2 aria-hidden="true" />
              {t('Remove')}
            </Button>
          ) : null}
        </div>
        {pictureError ? <p className="w-full text-sm text-destructive-strong">{pictureError}</p> : null}
        <div className="w-full empty:hidden">
          <FieldError state={state} name="picture" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field state={state} name="firstName" label={t('First name')}>
          <Input
            id="firstName"
            {...fieldAttributes(state, 'firstName')}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            maxLength={40}
            className={FIELD_CLASS}
          />
        </Field>
        <Field state={state} name="lastName" label={t('Last name')}>
          <Input
            id="lastName"
            {...fieldAttributes(state, 'lastName')}
            defaultValue={profile.lastName}
            autoComplete="family-name"
            maxLength={40}
            className={FIELD_CLASS}
          />
        </Field>
        <Field
          state={state}
          name="username"
          label={optional(t('Username'))}
          hint={t('A nickname. The app greets you with it instead of your first name.')}
          className="sm:col-span-2"
        >
          <Input
            id="username"
            {...fieldAttributes(state, 'username')}
            defaultValue={profile.username}
            autoComplete="nickname"
            maxLength={30}
            className={FIELD_CLASS}
          />
        </Field>
        <Field state={state} name="occupation" label={optional(t('Occupation'))} className="sm:col-span-2">
          <Input
            id="occupation"
            {...fieldAttributes(state, 'occupation')}
            defaultValue={profile.occupation}
            autoComplete="organization-title"
            maxLength={60}
            className={FIELD_CLASS}
          />
        </Field>
        <Field state={state} name="bio" label={optional(t('About you'))} className="sm:col-span-2">
          <textarea
            id="bio"
            {...fieldAttributes(state, 'bio')}
            defaultValue={profile.bio}
            rows={3}
            maxLength={160}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30"
          />
        </Field>
      </div>

      <fieldset className="space-y-4 border-t pt-5">
        <legend className="sr-only">{t('Contact and place')}</legend>
        <p className="text-sm font-semibold" aria-hidden="true">
          {t('Contact and place')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field state={state} name="phone" label={optional(t('Phone'))}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              {...fieldAttributes(state, 'phone')}
              defaultValue={profile.phone}
              autoComplete="tel"
              placeholder="+225 07 00 00 00 00"
              maxLength={20}
              className={FIELD_CLASS}
            />
          </Field>
          <Field state={state} name="birthDate" label={optional(t('Date of birth'))}>
            <Input
              id="birthDate"
              type="date"
              {...fieldAttributes(state, 'birthDate')}
              defaultValue={profile.birthDate}
              autoComplete="bday"
              className={FIELD_CLASS}
            />
          </Field>
          <Field state={state} name="country" label={optional(t('Country'))}>
            <Input
              id="country"
              {...fieldAttributes(state, 'country')}
              defaultValue={profile.country}
              autoComplete="country-name"
              maxLength={56}
              className={FIELD_CLASS}
            />
          </Field>
          <Field state={state} name="city" label={optional(t('City'))}>
            <Input
              id="city"
              {...fieldAttributes(state, 'city')}
              defaultValue={profile.city}
              autoComplete="address-level2"
              maxLength={60}
              className={FIELD_CLASS}
            />
          </Field>
          <Field
            state={state}
            name="timeZone"
            label={t('Time zone')}
            hint={t('Your days start and end at midnight in this time zone.')}
            className="sm:col-span-2"
          >
            <NativeSelect
              id="timeZone"
              // Remounted once the list is known, so the saved zone is selected.
              key={zoneChoices.length}
              {...fieldAttributes(state, 'timeZone')}
              defaultValue={profile.timeZone}
              className={FIELD_CLASS}
            >
              {profile.timeZone ? null : <NativeSelectOption value="">{t('Not set')}</NativeSelectOption>}
              {zoneChoices.map((zone) => (
                <NativeSelectOption key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </fieldset>

      <FormFooter state={state} isPending={isPending} />
    </form>
  )
}

export function CredentialsForm({ email }: { email: string }) {
  const t = useT()
  const { state, isPending, onSubmit } = useForm(changeCredentialsAction)

  return (
    // Keyed on success so the password fields empty themselves once saved.
    <form key={state.status === 'success' ? 'saved' : 'editing'} onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field state={state} name="email" label={t('Email')} className="sm:col-span-2">
          <Input
            id="email"
            type="email"
            {...fieldAttributes(state, 'email')}
            defaultValue={email}
            autoComplete="email"
            className={FIELD_CLASS}
          />
        </Field>
        <Field
          state={state}
          name="newPassword"
          label={t('New password')}
          hint={t('Leave empty to keep your password. At least 10 characters.')}
        >
          <Input
            id="newPassword"
            type="password"
            {...fieldAttributes(state, 'newPassword')}
            autoComplete="new-password"
            className={FIELD_CLASS}
          />
        </Field>
        <Field state={state} name="confirmPassword" label={t('Confirm password')}>
          <Input
            id="confirmPassword"
            type="password"
            {...fieldAttributes(state, 'confirmPassword')}
            autoComplete="new-password"
            className={FIELD_CLASS}
          />
        </Field>
        <Field
          state={state}
          name="currentPassword"
          label={t('Current password')}
          hint={t('Needed to change your email or your password.')}
          className="sm:col-span-2"
        >
          <Input
            id="currentPassword"
            type="password"
            {...fieldAttributes(state, 'currentPassword')}
            autoComplete="current-password"
            className={FIELD_CLASS}
          />
        </Field>
      </div>

      <FormFooter state={state} isPending={isPending} />
    </form>
  )
}
