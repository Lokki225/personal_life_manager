'use server'

import { revalidatePath } from 'next/cache'

import { isAccountRuleError } from '@/application/account/errors'
import { askAssistant } from '@/application/assistant/chat'
import { isAssistantConfigured } from '@/infrastructure/ai/claude'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { assistantRepository } from '@/infrastructure/repositories/assistantRepository'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { conversationSchema, notesForm } from './schema'

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
    }

    return { ok: true, reply: reply ?? t('I could not finish this. Try asking in smaller steps.') }
  } catch (error) {
    if (isAccountRuleError(error)) {
      return { ok: false, error: t(error.message) }
    }

    console.error('The assistant failed:', error)
    return { ok: false, error: t('The assistant is not answering right now. Try again in a moment.') }
  }
}

export async function setNotesAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  const state = await notesForm.submit(formData, ({ enabled }) => assistantRepository.setNotesEnabled(user.id, enabled))

  if (state.status === 'success') {
    revalidatePath('/finance/assistant')
  }

  return translateFormState(state, t)
}
