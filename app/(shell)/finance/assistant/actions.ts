'use server'

import { revalidatePath } from 'next/cache'

import { notifyLater } from '@/app/notify-later'
import { isAccountRuleError } from '@/application/account/errors'
import { askAssistant } from '@/application/assistant/chat'
import { getAppPersona, savePersonalPersona } from '@/application/assistant/persona'
import { notifyReachedGoals } from '@/application/notifications/instant'
import { AiBusy, AiModelUnavailable, AiOutOfCredit } from '@/infrastructure/ai/model'
import { availableProviders, isAssistantConfigured, resolveProvider } from '@/infrastructure/ai/providers'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { assistantRepository } from '@/infrastructure/repositories/assistantRepository'
import { setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { shortName } from '@/lib/greeting'
import { getT } from '@/lib/i18n/server'

import { conversationSchema, personaForm, providerSchema } from './schema'

// Everything the assistant window shows, loaded when it opens.
export type AssistantData = {
  callName: string | null
  providers: { id: string; name: string; model: string }[]
  provider: string | null
  notesOn: boolean
  notes: { id: string; kind: string; title: string; body: string; date: string }[]
  app: { name: string | null; role: string; personalAllowed: boolean }
  personal: { name: string | null; instructions: string | null }
}

export async function loadAssistantAction(): Promise<AssistantData | null> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user || !isAssistantConfigured()) {
    return null
  }

  const [settings, notes, app] = await Promise.all([
    assistantRepository.settings(user.id),
    assistantRepository.listNotes(user.id, 10),
    getAppPersona(),
  ])
  const dateFormatter = new Intl.DateTimeFormat(t.intl, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(user.timeZone ? { timeZone: user.timeZone } : {}),
  })

  return {
    callName: shortName(user),
    providers: availableProviders(),
    provider: resolveProvider(settings.provider)?.id ?? null,
    notesOn: settings.notes,
    notes: notes.map((note) => ({ ...note, date: dateFormatter.format(note.createdAt) })),
    app: { name: app.name, role: app.role, personalAllowed: app.personalAllowed },
    personal: { name: settings.assistantName, instructions: settings.assistantInstructions },
  }
}

export type AssistantAnswer = { ok: true; reply: string } | { ok: false; error: string }

// Answers the last message of the conversation.
export async function askAssistantAction(conversation: unknown): Promise<AssistantAnswer> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!user) {
    return { ok: false, error: t('Your session has ended. Sign in again to continue.') }
  }

  if (!isAssistantConfigured()) {
    return { ok: false, error: t('The assistant is not switched on yet.') }
  }

  const turns = conversationSchema.safeParse(conversation)

  if (!turns.success) {
    return { ok: false, error: t('Write a message first.') }
  }

  try {
    const { reply, changed } = await askAssistant(user, turns.data)

    // What the assistant recorded shows on every finance page.
    if (changed) {
      revalidatePath('/finance', 'layout')
      notifyLater(() => notifyReachedGoals(user.id))
    }

    return { ok: true, reply: reply ?? t('I could not finish this. Try asking in smaller steps.') }
  } catch (error) {
    if (isAccountRuleError(error)) {
      return { ok: false, error: t(error.message) }
    }

    if (error instanceof AiOutOfCredit) {
      return { ok: false, error: t('This AI has no credit left on its account. Choose another one, or add credit.') }
    }

    if (error instanceof AiBusy) {
      return {
        ok: false,
        error: t('This AI is overloaded right now. Try again in a moment, or choose another AI in Settings.'),
      }
    }

    if (error instanceof AiModelUnavailable) {
      console.error('The assistant model is unavailable:', error.message)
      return { ok: false, error: t('The model of this AI is no longer available. Choose another AI, or change its model in the server settings.') }
    }

    console.error('The assistant failed:', error)
    return { ok: false, error: t('The assistant is not answering right now. Try again in a moment.') }
  }
}

export async function setNotesAction(enabled: boolean): Promise<{ error?: string }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  if (!(await writesAllowed(user.id))) {
    return { error: t(TOO_MANY_WRITES) }
  }

  await assistantRepository.setNotesEnabled(user.id, enabled === true)

  return {}
}

export async function setProviderAction(provider: unknown): Promise<{ error?: string }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  if (!(await writesAllowed(user.id))) {
    return { error: t(TOO_MANY_WRITES) }
  }

  const choice = providerSchema.safeParse({ provider })

  if (!choice.success) {
    return { error: t('Choose an AI.') }
  }

  await assistantRepository.setProvider(user.id, choice.data.provider)

  return {}
}

export async function savePersonaAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  if (!(await writesAllowed(user.id))) {
    return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }
  }

  const state = await personaForm.submit(formData, (persona) =>
    savePersonalPersona(user.id, persona, { appPersona: () => getAppPersona(), save: assistantRepository.setPersona }),
  )

  return translateFormState(state, t)
}
