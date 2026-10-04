import { CURRENCY_CODE } from '../../domain/finance/calculations'
import type { PushMessage } from '../../infrastructure/push/sendPush'
import {
  notificationRepository,
  type NotificationRepository,
  type NotifiedPerson,
} from '../../infrastructure/repositories/notificationRepository'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../lib/i18n/config'
import { createTranslator, type Translator } from '../../lib/i18n/translate'
import { recomputeFinanceState } from '../finance/recomputeFinanceState'
import { notifyDevices } from './notify'

// What is told the moment it happens, rather than in the evening.

export type InstantEvent =
  // A savings goal's chest reached its target.
  | { kind: 'goalReached'; goalId: string; name: string }
  // A program with one of the person's API keys changed their finances.
  // `action` is the English sentence of what it did, with an optional {amount}.
  | { kind: 'changedByKey'; tokenId: string; keyName: string; action: string; amount?: number }
  // Security notices: always sent.
  | { kind: 'credentialsChanged'; email: boolean; password: boolean }
  | { kind: 'resetLinkCreated' }
  | { kind: 'apiKeyCreated'; name: string }
  // For administrators.
  | { kind: 'newAccount'; name: string; email: string }
  | { kind: 'newFeedback'; name: string; message: string }

type Group = 'money' | 'security' | 'admin'

const GROUP: Record<InstantEvent['kind'], Group> = {
  goalReached: 'money',
  changedByKey: 'money',
  credentialsChanged: 'security',
  resetLinkCreated: 'security',
  apiKeyCreated: 'security',
  newAccount: 'admin',
  newFeedback: 'admin',
}

const wants = (person: NotifiedPerson, group: Group) =>
  group === 'security' || (group === 'money' ? person.notifyMoney : person.notifyAdmin)

// What makes an event the same one again, when it must be told only once: a
// goal once, and a key's changes at most once an hour.
function onceKey(event: InstantEvent, now: Date): string | null {
  switch (event.kind) {
    case 'goalReached':
      return `goal:${event.goalId}`
    case 'changedByKey':
      return `key:${event.tokenId}:${now.toISOString().slice(0, 13)}`
    default:
      return null
  }
}

const localeOf = (locale: string | null): Locale =>
  LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE

// The words of an instant notification, in the person's language.
export function instantMessage(event: InstantEvent, t: Translator): PushMessage {
  const money = (amount: number) => `${t.amount(amount)} ${CURRENCY_CODE}`

  switch (event.kind) {
    case 'goalReached':
      return {
        title: t('Goal reached: {name}', { name: event.name }),
        body: t('Its chest has reached its target. Well done!'),
        url: '/finance/goals',
      }
    case 'changedByKey':
      return {
        title: t('The key "{name}" changed your finances', { name: event.keyName }),
        body: t(event.action, event.amount === undefined ? {} : { amount: money(event.amount) }),
        url: '/finance/history',
      }
    case 'credentialsChanged':
      return {
        title: t('Your sign-in details were changed'),
        body: `${
          event.email && event.password
            ? t('Your email and password were changed.')
            : event.email
              ? t('Your email was changed.')
              : t('Your password was changed.')
        } ${t('If it was not you, ask an administrator for a reset link.')}`,
        url: '/account',
      }
    case 'resetLinkCreated':
      return {
        title: t('A password reset link was created'),
        body: t('An administrator created a link to reset your password. If you did not ask for it, tell them.'),
        url: '/account',
      }
    case 'apiKeyCreated':
      return {
        title: t('A new API key was created'),
        body: t('The key "{name}" can now use the app as you. If it was not you, delete it in My account.', {
          name: event.name,
        }),
        url: '/account',
      }
    case 'newAccount':
      return {
        title: t('New account: {name}', { name: event.name }),
        body: t('{email} just signed up.', { email: event.email }),
        url: '/admin',
      }
    case 'newFeedback':
      return {
        title: t('New opinion from {name}', { name: event.name }),
        body: event.message.length > 140 ? `${event.message.slice(0, 139).trimEnd()}…` : event.message,
        url: '/admin',
      }
  }
}

type Deps = {
  repository: Pick<NotificationRepository, 'person' | 'admins' | 'claim'>
  notify: typeof notifyDevices
}

const defaultDeps: Deps = { repository: notificationRepository, notify: notifyDevices }

async function tell(person: NotifiedPerson, event: InstantEvent, deps: Deps, now: Date): Promise<number> {
  if (person.subscriptions.length === 0 || !wants(person, GROUP[event.kind])) {
    return 0
  }

  const key = onceKey(event, now)

  if (key && !(await deps.repository.claim(person.id, key))) {
    return 0
  }

  return deps.notify(person.subscriptions, instantMessage(event, createTranslator(localeOf(person.locale))))
}

// Tells one person, if they want to hear about this kind of event.
export async function notifyPerson(
  userId: string,
  event: InstantEvent,
  deps: Deps = defaultDeps,
  now: Date = new Date(),
): Promise<number> {
  const person = await deps.repository.person(userId)

  return person ? tell(person, event, deps, now) : 0
}

// Tells every administrator who wants administration alerts.
export async function notifyAdmins(event: InstantEvent, deps: Deps = defaultDeps, now: Date = new Date()): Promise<number> {
  let delivered = 0

  for (const admin of await deps.repository.admins()) {
    delivered += await tell(admin, event, deps, now)
  }

  return delivered
}

type GoalState = { id: string; name: string; satisfied: boolean; conditionResults: { measurement: string }[] }

// The savings goals whose chest reached its target. Goals built only from
// other measurements (exceptions in a month) come and go with the month, so
// they are not announced.
export const reachedSavingsGoals = (goals: GoalState[]) =>
  goals
    .filter((goal) => goal.satisfied && goal.conditionResults.some((result) => result.measurement === 'chest_balance'))
    .map((goal) => ({ id: goal.id, name: goal.name }))

// After money moved: announces each savings goal that is now reached, once.
export async function notifyReachedGoals(
  userId: string,
  deps: { goals: (userId: string) => Promise<GoalState[]>; notifyPerson: typeof notifyPerson } = {
    goals: async (id) => (await recomputeFinanceState({ userId: id })).goals,
    notifyPerson,
  },
): Promise<void> {
  for (const goal of reachedSavingsGoals(await deps.goals(userId))) {
    await deps.notifyPerson(userId, { kind: 'goalReached', goalId: goal.id, name: goal.name })
  }
}
