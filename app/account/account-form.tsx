'use client'

import { startTransition, useActionState, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Check, CircleAlert, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { Avatar } from '../avatar'
import { updateProfileAction } from './actions'
import { REMOVE_PICTURE } from './schema'

const PICTURE_SIZE = 160

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

export function AccountForm({ username, picture }: { username: string; picture: string | null }) {
  const t = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(username)
  // What will be saved: a new image, REMOVE_PICTURE, or '' to keep the current one.
  const [pictureChange, setPictureChange] = useState('')
  const [pictureError, setPictureError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialFormState)

  const shownPicture = pictureChange === REMOVE_PICTURE ? null : pictureChange || picture

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="picture" value={pictureChange} />

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} picture={shownPicture} className="size-20 text-2xl" />
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

      <div className="grid gap-2">
        <Label htmlFor="username">{t('Name')}</Label>
        <Input
          id="username"
          {...fieldAttributes(state, 'username')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('How the app should call you')}
          autoComplete="nickname"
          maxLength={30}
          className="h-11 text-base sm:text-sm"
        />
        <FieldError state={state} name="username" />
      </div>

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
    </form>
  )
}
