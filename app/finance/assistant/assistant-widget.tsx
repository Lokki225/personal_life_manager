'use client'

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUp, BellOff, BellRing, CircleAlert, Loader2, NotebookText, Settings2, Sparkles, SquarePen, X } from 'lucide-react'
import { Dialog } from 'radix-ui'

import type { ChatTurn } from '@/application/assistant/converse'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import {
  askAssistantAction,
  loadAssistantAction,
  savePersonaAction,
  setNotesAction,
  setProviderAction,
  type AssistantData,
} from './actions'

type View = 'chat' | 'notes' | 'settings'

const SUGGESTIONS = [
  m('How is my month going?'),
  m('I spent 1500 on lunch'),
  m('How much can I still spend today?'),
  m('Am I on track with my goals?'),
]

const KIND_LABELS: Record<string, string> = {
  daily: m('Evening note'),
  weekly: m('Week review'),
  monthly: m('Month review'),
}

function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground',
        className ?? 'size-8',
      )}
    >
      <Sparkles className="size-[55%]" aria-hidden="true" />
    </span>
  )
}

// --- Chat ----------------------------------------------------------------------

function Chat({
  turns,
  setTurns,
  callName,
}: {
  turns: ChatTurn[]
  setTurns: (turns: ChatTurn[]) => void
  callName: string | null
}) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startAsking] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  // Keeps the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-6 py-6 text-center">
            <Mark className="size-12" />
            <p className="text-xl font-semibold tracking-tight">
              {callName ? t('Hello {name}, how can I help?', { name: callName }) : t('How can I help?')}
            </p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(t(suggestion))}
                  disabled={isPending}
                  className="min-h-12 rounded-2xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {t(suggestion)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="space-y-5" aria-live="polite">
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <li key={index} className="flex justify-end">
                  <p className="max-w-[85%] rounded-3xl bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">{turn.text}</p>
                </li>
              ) : (
                <li key={index} className="flex gap-3">
                  <Mark className="mt-0.5 size-7" />
                  <p className="min-w-0 flex-1 pt-1 text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                </li>
              ),
            )}
            {isPending ? (
              <li className="flex items-center gap-3">
                <Mark className="size-7" />
                <span className="flex gap-1" role="status" aria-label={t('Thinking...')}>
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              </li>
            ) : null}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t bg-background/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {error ? (
          <p
            role="alert"
            className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 rounded-3xl border bg-card p-1.5 pl-4 shadow-sm focus-within:ring-[3px] focus-within:ring-ring/30"
        >
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
            className="field-sizing-content max-h-40 min-h-10 w-full min-w-0 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isPending || !draft.trim()}
            className="size-10 shrink-0 rounded-full"
            aria-label={t('Send')}
          >
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
          </Button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {t('The assistant can make mistakes. Check what it records.')}
        </p>
      </div>
    </div>
  )
}

// --- Notes -----------------------------------------------------------------------

function Notes({ data, reload }: { data: AssistantData; reload: () => void }) {
  const t = useT()
  const [isPending, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toggle = () =>
    startSaving(async () => {
      const result = await setNotesAction(!data.notesOn)
      setError(result.error ?? null)
      reload()
    })

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div className="space-y-2 rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">{t('Evening notes')}</p>
        <p className="text-sm text-muted-foreground">
          {t(
            'Every evening, a short note on your day. On Sundays, the review of your week; on the last day of the month, the review of your month.',
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('They arrive as notifications when notifications are on in My account.')}
        </p>
        <Button
          type="button"
          variant={data.notesOn ? 'outline' : 'default'}
          disabled={isPending}
          onClick={toggle}
          className="h-11"
        >
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : data.notesOn ? (
            <BellOff aria-hidden="true" />
          ) : (
            <BellRing aria-hidden="true" />
          )}
          {data.notesOn ? t('Turn off evening notes') : t('Turn on evening notes')}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive-strong">
            {error}
          </p>
        ) : null}
      </div>

      {data.notes.length > 0 ? (
        <ul className="space-y-2">
          {data.notes.map((note, index) => (
            <li key={note.id}>
              <details open={index === 0} className="rounded-2xl border bg-card px-4 py-1">
                <summary className="flex min-h-12 cursor-pointer list-none flex-col justify-center py-2">
                  <span className="text-sm font-medium">{note.title}</span>
                  <span className="text-xs text-muted-foreground first-letter:uppercase">
                    {t(KIND_LABELS[note.kind] ?? KIND_LABELS.daily)} · {note.date}
                  </span>
                </summary>
                <p className="pb-3 text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">{t('No notes yet.')}</p>
      )}
    </div>
  )
}

// --- Settings ----------------------------------------------------------------------

function Settings({ data, reload }: { data: AssistantData; reload: () => void }) {
  const t = useT()
  const [isPending, startSaving] = useTransition()
  const [providerError, setProviderError] = useState<string | null>(null)
  const [state, formAction, isSaving] = useActionState(savePersonaAction, initialFormState)

  // The window shows what was saved.
  useEffect(() => {
    if (state.status === 'success') {
      reload()
    }
  }, [state, reload])

  const chooseProvider = (provider: string) =>
    startSaving(async () => {
      const result = await setProviderAction(provider)
      setProviderError(result.error ?? null)
      reload()
    })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {data.providers.length > 1 ? (
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <Label htmlFor="assistant-provider">{t('Which AI answers')}</Label>
          <NativeSelect
            id="assistant-provider"
            key={data.provider ?? 'none'}
            defaultValue={data.provider ?? undefined}
            disabled={isPending}
            onChange={(event) => chooseProvider(event.target.value)}
            className="h-11 text-base sm:text-sm"
          >
            {data.providers.map((provider) => (
              <NativeSelectOption key={provider.id} value={provider.id}>
                {provider.name} ({provider.model})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {providerError ? (
            <p role="alert" className="text-sm text-destructive-strong">
              {providerError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div>
          <p className="text-sm font-semibold">{t('Your assistant')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Give it a name, and tell it how you want it to help you. The rules of the app always come first.')}
          </p>
        </div>

        {data.app.personalAllowed ? (
          <form
            key={`${data.personal.name}-${data.personal.instructions}`}
            onSubmit={onSubmit}
            className="space-y-3"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="assistant-name">{t('Its name')}</Label>
              <Input
                id="assistant-name"
                {...fieldAttributes(state, 'name', 'assistant')}
                defaultValue={data.personal.name ?? ''}
                placeholder={data.app.name ?? t('Assistant')}
                maxLength={30}
                className="h-11 text-base sm:text-sm"
              />
              <FieldError state={state} name="name" scope="assistant" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assistant-instructions">{t('Your instructions')}</Label>
              <textarea
                id="assistant-instructions"
                {...fieldAttributes(state, 'instructions', 'assistant')}
                defaultValue={data.personal.instructions ?? ''}
                placeholder={t('For example: call me Awa, answer in short sentences, remind me I am saving for a laptop.')}
                maxLength={2000}
                rows={5}
                className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
              />
              <FieldError state={state} name="instructions" scope="assistant" />
            </div>
            {state.formErrors.length > 0 ? (
              <p role="alert" className="text-sm text-destructive-strong">
                {state.formErrors[0]}
              </p>
            ) : null}
            <Button type="submit" disabled={isSaving} className="h-11">
              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {t('Save')}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{t('The administrators have turned off personal instructions.')}</p>
        )}
      </div>

      <details className="rounded-2xl border bg-card px-4 py-1">
        <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm font-medium">
          {t('Its role in this app')}
        </summary>
        <p className="pb-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{data.app.role}</p>
      </details>
    </div>
  )
}

// --- Window ----------------------------------------------------------------------

// The round button at the bottom right of the finance pages, and the window it
// opens. The conversation stays while moving between pages.
export function AssistantWidget() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // A notification opens the window on the notes: "/finance?assistant=notes".
  const asked = searchParams.get('assistant')
  const [open, setOpen] = useState(asked !== null)
  const [view, setView] = useState<View>(asked === 'notes' ? 'notes' : 'chat')
  const [data, setData] = useState<AssistantData | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])

  // The same function on every render, so the settings can depend on it.
  const reload = useCallback(() => {
    void loadAssistantAction().then(setData)
  }, [])

  // Loads what the window shows the first time it opens.
  useEffect(() => {
    if (open && !data) {
      void loadAssistantAction().then(setData)
    }
  }, [open, data])

  const onOpenChange = (next: boolean) => {
    setOpen(next)

    // Closing forgets the address that opened it, so a reload does not reopen it.
    if (!next && asked !== null) {
      router.replace(pathname, { scroll: false })
    }
  }

  const name = data?.personal.name || data?.app.name || t('Assistant')
  const providerName = data?.providers.find((provider) => provider.id === data.provider)?.name
  const tabs: { id: View; label: string; icon: typeof Sparkles }[] = [
    { id: 'chat', label: t('Chat'), icon: Sparkles },
    { id: 'notes', label: t('Notes'), icon: NotebookText },
    { id: 'settings', label: t('Settings'), icon: Settings2 },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        className="fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-[var(--shadow-soft)] ring-4 ring-background transition-transform outline-none hover:scale-105 focus-visible:ring-ring/50 active:scale-95 sm:right-6 sm:bottom-6"
        aria-label={t('Open the assistant')}
      >
        <Sparkles className="size-6" aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(44rem,calc(100dvh-3rem))] sm:w-[26rem] sm:overflow-hidden sm:rounded-3xl sm:border sm:shadow-2xl"
          aria-describedby={undefined}
        >
          <header className="flex items-center gap-3 border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <Mark className="size-9" />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold">{name}</Dialog.Title>
              <p className="truncate text-xs text-muted-foreground">
                {providerName ? t('With {name}', { name: providerName }) : t('Your money assistant')}
              </p>
            </div>
            {view === 'chat' && turns.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTurns([])}
                className="size-10 rounded-full"
                aria-label={t('New conversation')}
              >
                <SquarePen aria-hidden="true" />
              </Button>
            ) : null}
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="size-10 rounded-full" aria-label={t('Close')}>
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>

          <nav className="flex gap-1 border-b px-3 py-2" aria-label={t('Assistant sections')}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={view === id ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors',
                  view === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          {view === 'chat' ? (
            <Chat turns={turns} setTurns={setTurns} callName={data?.callName ?? null} />
          ) : !data ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label={t('Loading')} />
            </div>
          ) : view === 'notes' ? (
            <Notes data={data} reload={reload} />
          ) : (
            <Settings data={data} reload={reload} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
