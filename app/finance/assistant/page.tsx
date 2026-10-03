import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardContent } from '@/components/ui/card'
import { hasSetupPlan } from '@/application/finance/createSetupPlan'
import { isAssistantConfigured } from '@/infrastructure/ai/claude'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { assistantRepository } from '@/infrastructure/repositories/assistantRepository'
import { setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'

import { ensureDaysSettled } from '../settle'
import { AssistantChat, AssistantMark, NotesSwitch } from './assistant-chat'

// An answer can take several steps of the model.
export const maxDuration = 60

const KIND_LABELS: Record<string, string> = {
  daily: m('Evening note'),
  weekly: m('Week review'),
  monthly: m('Month review'),
}

export default async function AssistantPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  if (!user) {
    redirect('/login')
  }

  if (!(await hasSetupPlan(user.id))) {
    redirect('/finance/setup')
  }

  const configured = isAssistantConfigured()
  const [notes, notesOn] = configured
    ? await Promise.all([assistantRepository.listNotes(user.id, 10), assistantRepository.notesEnabled(user.id)])
    : [[], false]
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header className="flex items-start gap-3 pr-28">
        <AssistantMark />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Assistant')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Ask about your money, or tell it what you spent. It reads and records for you.')}
          </p>
        </div>
      </header>

      {!configured ? (
        <Card className="gap-0 py-5">
          <CardContent className="space-y-1">
            <h2 className="text-base font-semibold">{t('The assistant is not switched on yet.')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('It needs an AI key on the server. Once it is set, you can talk to it here.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <AssistantChat />
              <p className="text-xs text-muted-foreground">
                {t('To answer, the assistant reads your figures and sends them to the AI provider. Check what it records.')}
              </p>
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{t('Evening notes')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    'Every evening, a short note on your day. On Sundays, the review of your week; on the last day of the month, the review of your month.',
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('They arrive as notifications when notifications are on in')}{' '}
                  <Link href="/account" className="font-medium text-foreground underline underline-offset-4">
                    {t('My account')}
                  </Link>
                  .
                </p>
              </div>
              <NotesSwitch enabled={notesOn} />

              {notes.length > 0 ? (
                <ul className="divide-y rounded-lg border">
                  {notes.map((note, index) => (
                    <li key={note.id}>
                      <details open={index === 0} className="group px-3 py-2.5">
                        <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center">
                          <span className="text-sm font-medium">{note.title}</span>
                          <span className="text-xs text-muted-foreground first-letter:uppercase">
                            {t(KIND_LABELS[note.kind] ?? KIND_LABELS.daily)} · {dateFormatter.format(note.createdAt)}
                          </span>
                        </summary>
                        <p className="pt-2 pb-1 text-sm whitespace-pre-wrap">{note.body}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
