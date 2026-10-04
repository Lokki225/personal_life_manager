import { AccountRuleError } from '../account/errors'
import { withOrigin } from '../../lib/origin'
import type { ApiUser } from '../api/operation'
import type { AskModel } from '../../infrastructure/ai/model'
import { modelFor } from '../../infrastructure/ai/providers'
import { assistantRepository } from '../../infrastructure/repositories/assistantRepository'
import { securityRepository, type SecurityRepository } from '../../infrastructure/repositories/securityRepository'
import { converse, type ChatTurn } from './converse'
import { combinePersona, getAppPersona, type Persona } from './persona'
import { chatOperations } from './tools'

// Each message costs money at the AI provider: a day's limit per person keeps
// one account from spending for everyone.
export const ASSISTANT_DAILY_LIMIT = 60
const DAY = 24 * 60 * 60 * 1000

// What is sent along of a conversation: the latest turns, each of a sensible length.
export const MAX_TURNS = 20
export const MAX_TURN_LENGTH = 2000

type ChatDeps = {
  security: Pick<SecurityRepository, 'allowAttempt'>
  converse: typeof converse
  // The model of the provider the person chose, and who their assistant is.
  contextOf: (userId: string) => Promise<{ ask: AskModel; persona: Persona }>
}

const defaultDeps: ChatDeps = {
  security: securityRepository,
  converse,
  contextOf: async (userId) => {
    const [settings, app] = await Promise.all([assistantRepository.settings(userId), getAppPersona()])

    return { ask: modelFor(settings.provider), persona: combinePersona(app, settings) }
  },
}

// Keeps what the model can use: the latest turns, starting with the person,
// ending with what they just said.
export function trimConversation(history: ChatTurn[]): ChatTurn[] {
  const turns = history
    .map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, MAX_TURN_LENGTH) }))
    .filter((turn) => turn.text.length > 0)
    .slice(-MAX_TURNS)

  while (turns.length > 0 && turns[0].role !== 'user') {
    turns.shift()
  }

  return turns
}

export async function askAssistant(
  user: ApiUser,
  history: ChatTurn[],
  deps: ChatDeps = defaultDeps,
): Promise<{ reply: string | null; changed: boolean }> {
  const turns = trimConversation(history)

  if (turns.at(-1)?.role !== 'user') {
    throw new AccountRuleError('Write a message first.')
  }

  if (!(await deps.security.allowAttempt(`assistant:${user.id}`, ASSISTANT_DAILY_LIMIT, DAY))) {
    throw new AccountRuleError('You have used all your messages to the assistant for today. Try again tomorrow.')
  }

  const context = await deps.contextOf(user.id)

  // What the assistant records is marked as its doing, for the history.
  return withOrigin('assistant', () => deps.converse(user, turns, { ...context, operations: chatOperations }))
}
