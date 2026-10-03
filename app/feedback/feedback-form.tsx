'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { CircleAlert, Heart, Loader2, Send, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Label } from '@/components/ui/label'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

import { sendFeedbackAction } from './actions'
import { KIND_LABELS } from './kinds'

const KINDS = Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]

// What a person thinks of the app: a rating, what it is about, their words,
// and whether they want to hear about what is new.
export function FeedbackForm({ wantsNews }: { wantsNews: boolean }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(sendFeedbackAction, initialFormState)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [kind, setKind] = useState('idea')
  const [round, setRound] = useState(0)
  // The answer already thanked for, once the person chose to send another.
  const [acknowledged, setAcknowledged] = useState<FormState | null>(null)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  if (state.status === 'success' && state !== acknowledged) {
    return (
      <div className="animate-pop-in space-y-3 py-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Heart className="size-6" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold">{t('Thank you!')}</p>
        <p className="text-sm text-muted-foreground">{t('Your opinion was sent. It helps decide what comes next.')}</p>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => {
            setRating(0)
            setAcknowledged(state)
            setRound((value) => value + 1)
          }}
        >
          {t('Send another one')}
        </Button>
      </div>
    )
  }

  const shown = hovered || rating

  return (
    // Keyed so a second opinion starts from an empty form.
    <form key={round} onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('How do you like the app?')}</legend>
        <input type="hidden" name="rating" value={rating || ''} />
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value === rating ? 0 : value)}
              onMouseEnter={() => setHovered(value)}
              aria-pressed={value <= rating}
              aria-label={t.plural(value, '{count} star', '{count} stars')}
              className="flex size-11 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                className={cn(
                  'size-7 transition-colors',
                  value <= shown ? 'fill-warning text-warning' : 'text-muted-foreground/50',
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('What is it about?')}</legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="flex flex-wrap gap-2">
          {KINDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                kind === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
              )}
            >
              {t(KIND_LABELS[value])}
            </button>
          ))}
        </div>
        <FieldError state={state} name="kind" scope="feedback" />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="feedback-message">{t('Your words')}</Label>
        <textarea
          id="feedback-message"
          {...fieldAttributes(state, 'message', 'feedback')}
          rows={5}
          maxLength={2000}
          placeholder={t('What do you like, what bothers you, what is missing?')}
          className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive sm:text-sm"
        />
        <FieldError state={state} name="message" scope="feedback" />
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="wantsNews"
          defaultChecked={wantsNews}
          className="size-5 shrink-0 accent-[var(--primary)]"
        />
        {t('Keep me informed about new features')}
      </label>

      {state.formErrors.length > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-11 w-full sm:w-auto">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {t('Send my opinion')}
      </Button>
    </form>
  )
}
