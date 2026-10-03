import { feedbackRepository, type FeedbackRepository } from '../../infrastructure/repositories/feedbackRepository'
import { securityRepository, type SecurityRepository } from '../../infrastructure/repositories/securityRepository'
import { AccountRuleError } from './errors'

// What people think of the app, in their own words, for the administrators to
// read; and whether they want to hear about what is new.

export const FEEDBACK_KINDS = ['idea', 'problem', 'praise', 'other'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const MAX_FEEDBACK_LENGTH = 2000

// Enough for anyone with things to say, not enough to flood the inbox.
const PER_DAY = 10
const DAY = 24 * 60 * 60 * 1000

type SendDeps = {
  feedback: Pick<FeedbackRepository, 'addFeedback' | 'setWantsNews'>
  security: Pick<SecurityRepository, 'allowAttempt'>
}

const defaultSendDeps: SendDeps = { feedback: feedbackRepository, security: securityRepository }

export async function sendFeedback(
  userId: string,
  input: { rating?: number | null; kind: FeedbackKind; message: string; wantsNews: boolean },
  deps: SendDeps = defaultSendDeps,
): Promise<void> {
  const message = input.message.trim().slice(0, MAX_FEEDBACK_LENGTH)

  if (!message) {
    throw new AccountRuleError('Write a few words.', 'message')
  }

  if (!(await deps.security.allowAttempt(`feedback:${userId}`, PER_DAY, DAY))) {
    throw new AccountRuleError('Thank you! You have sent a lot today; send the rest tomorrow.')
  }

  const rating = input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null

  await deps.feedback.addFeedback(userId, { rating, kind: input.kind, message })
  await deps.feedback.setWantsNews(userId, input.wantsNews)
}

const ONLY_ADMINS = 'Only an administrator can see this.'

// Everything the administrators see: the latest opinions, with who wrote
// them, and who wants news.
export async function getFeedbackInbox(
  actor: { role: string },
  repository: Pick<FeedbackRepository, 'listFeedback' | 'summary' | 'listNewsReaders'> = feedbackRepository,
) {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError(ONLY_ADMINS)
  }

  const [items, summary, newsReaders] = await Promise.all([
    repository.listFeedback(50),
    repository.summary(),
    repository.listNewsReaders(),
  ])

  return { items, summary, newsReaders }
}

export async function markFeedbackRead(
  actor: { role: string },
  repository: Pick<FeedbackRepository, 'markAllRead'> = feedbackRepository,
  now: Date = new Date(),
): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError(ONLY_ADMINS)
  }

  await repository.markAllRead(now)
}
