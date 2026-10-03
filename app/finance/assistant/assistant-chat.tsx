'use client'

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { BellOff, BellRing, CircleAlert, Loader2, RotateCcw, SendHorizontal, Sparkles } from 'lucide-react'

import type { ChatTurn } from '@/application/assistant/converse'
import { Button } from '@/components/ui/button'
import { initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { askAssistantAction, setNotesAction } from './actions'

const SUGGESTIONS = [
  m('How is my month going?'),
  m('I spent 1500 on lunch'),
  m('How much can I still spend today?'),
  m('Am I on track with my goals?'),
]

// A conversation with the assistant. It lives as long as the page is open.
export function AssistantChat() {
  const t = useT()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startAsking] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  // Keeps the latest message in view.
  useEffect(() => {
    if (turns.length > 0) {
      endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [turns, isPending])

  const send = (text: string) => {
    const message = text.trim()

    if (!message || isPending) {
      return
    }

    const asked: ChatTurn[] = [...turns, { role: 'user', text: message }]
    setTurns(asked)
    setDraft('')
    setError(null)

    startAsking(async () => {
      const answer = await askAssistantAction(asked)

      if (answer.ok) {
        setTurns([...asked, { role: 'assistant', text: answer.reply }])
      } else {
        // Back as it was, with the message ready to send again.
        setTurns(turns)
        setDraft(message)
        setError(answer.error)
      }
    })
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send(draft)
  }

  return (
    <div className="space-y-3">
      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(t(suggestion))}
              disabled={isPending}
              className="min-h-11 rounded-full border bg-card px-4 text-left text-sm shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              {t(suggestion)}
            </button>
          ))}
        </div>
      ) : (
        <ol className="space-y-3" aria-live="polite">
          {turns.map((turn, index) => (
            <li key={index} className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}>
              <p
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                  turn.role === 'user'
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border bg-card shadow-sm',
                )}
              >
                {turn.text}
              </p>
            </li>
          ))}
          {isPending ? (
            <li className="flex justify-start">
              <p className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t('Thinking...')}
              </p>
            </li>
          ) : null}
        </ol>
      )}
      <div ref={endRef} />

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <label htmlFor="assistant-message" className="sr-only">
          {t('Your message')}
        </label>
        <textarea
          id="assistant-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter starts a new line.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send(draft)
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={t('Ask anything, or say what you spent...')}
          className="field-sizing-content max-h-40 min-h-11 w-full min-w-0 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
        />
        <Button type="submit" size="icon" disabled={isPending || !draft.trim()} className="size-11 shrink-0" aria-label={t('Send')}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
        </Button>
      </form>

      {turns.length > 0 && !isPending ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setTurns([])
            setError(null)
          }}
          className="h-11 text-muted-foreground"
        >
          <RotateCcw aria-hidden="true" />
          {t('New conversation')}
        </Button>
      ) : null}
    </div>
  )
}

// Turns the evening notes on or off.
export function NotesSwitch({ enabled }: { enabled: boolean }) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(setNotesAction, initialFormState)
  const error = state.formErrors[0] ?? Object.values(state.fieldErrors)[0]?.[0]

  const toggle = () => {
    const formData = new FormData()
    formData.set('enabled', String(!enabled))
    startTransition(() => formAction(formData))
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={enabled ? 'outline' : 'default'} disabled={isPending} onClick={toggle} className="h-11">
        {isPending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : enabled ? (
          <BellOff aria-hidden="true" />
        ) : (
          <BellRing aria-hidden="true" />
        )}
        {enabled ? t('Turn off evening notes') : t('Turn on evening notes')}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function AssistantMark() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Sparkles className="size-5" aria-hidden="true" />
    </span>
  )
}
