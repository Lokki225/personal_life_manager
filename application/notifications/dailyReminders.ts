import { CURRENCY_CODE } from '../../domain/finance/calculations'
import { dailyReminders, type Reminder } from '../../domain/finance/reminders'
import type { PushMessage } from '../../infrastructure/push/sendPush'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { pushRepository, type PushRecipient } from '../../infrastructure/repositories/pushRepository'
import { now as clockNow, withClockZone } from '../../lib/clock'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../lib/i18n/config'
import { createTranslator, type Translator } from '../../lib/i18n/translate'
import { listPendingIncomes } from '../finance/confirmIncome'
import { listDebtsWithStatus } from '../finance/debts'
import { notifyDevices } from './notify'

// Never more than this many notifications for one person in one run.
const MAX_PER_PERSON = 3

type ReminderFacts = Omit<Parameters<typeof dailyReminders>[0], 'today'>

type Deps = {
  listRecipients: () => Promise<PushRecipient[]>
  // What is true for one person right now, on their own clock.
  factsFor: (userId: string, today: Date) => Promise<ReminderFacts>
  notify: typeof notifyDevices
}

const sameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()

const defaultDeps: Deps = {
  listRecipients: pushRepository.listRecipients,
  factsFor: async (userId, today) => {
    const [incomes, expenses, pendingIncomes, debts] = await Promise.all([
      financeRepository.listIncomes(userId),
      financeRepository.listExpenses(userId),
      listPendingIncomes(userId, today),
      listDebtsWithStatus(userId),
    ])

    return {
      hasPlan: incomes.length > 0,
      expensesToday: expenses.filter((expense) => sameDay(new Date(expense.date), today)).length,
      pendingIncomes,
      debts,
    }
  },
  notify: notifyDevices,
}

// The words of one reminder, in the person's language.
export function reminderMessage(reminder: Reminder, t: Translator): PushMessage {
  const money = (amount: number) => `${t.amount(amount)} ${CURRENCY_CODE}`
  const when = (daysLeft: number) => (daysLeft === 0 ? t('today') : daysLeft === 1 ? t('tomorrow') : t('in 2 days'))

  switch (reminder.kind) {
    case 'recordSpending':
      return {
        title: t('Anything spent today?'),
        body: t('Record it before the day ends, so tomorrow starts right.'),
        url: '/finance',
      }
    case 'confirmIncome':
      return {
        title: t('Has {source} arrived?', { source: reminder.source }),
        body: t('Confirm it to fill your chests.'),
        url: '/finance',
      }
    case 'repaymentDue':
      return {
        title: t('A repayment is due {when}', { when: when(reminder.daysLeft) }),
        body: t('You owe {name} {amount}.', { name: reminder.counterparty, amount: money(reminder.amount) }),
        url: '/finance/debts',
      }
    case 'repaymentLate':
      return {
        title: t('A repayment is late'),
        body: t('You still owe {name} {amount}.', { name: reminder.counterparty, amount: money(reminder.amount) }),
        url: '/finance/debts',
      }
    case 'loanDue':
      return {
        title: t('Money is due back {when}', { when: when(reminder.daysLeft) }),
        body: t('{name} owes you {amount}.', { name: reminder.counterparty, amount: money(reminder.amount) }),
        url: '/finance/debts',
      }
    case 'loanLate':
      return {
        title: t('A loan is late coming back'),
        body: t('{name} still owes you {amount}.', { name: reminder.counterparty, amount: money(reminder.amount) }),
        url: '/finance/debts',
      }
  }
}

const localeOf = (locale: string | null): Locale =>
  LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE

// Runs once a day. For each person with a device to notify, works out on
// their own clock what is worth a reminder, and sends it in their language.
// Those in `notedToday` already got the assistant's note, which covers the
// reminder to record their spending.
export async function sendDailyReminders(
  deps: Deps = defaultDeps,
  notedToday: ReadonlySet<string> = new Set(),
): Promise<{ people: number; sent: number }> {
  const recipients = await deps.listRecipients()
  let sent = 0

  for (const person of recipients) {
    // One person's trouble must not stop the reminders of everyone after them.
    try {
      sent += await withClockZone(person.timeZone, async () => {
        const today = clockNow()
        const reminders = dailyReminders({ today, ...(await deps.factsFor(person.id, today)) })
          .filter((reminder) => !(reminder.kind === 'recordSpending' && notedToday.has(person.id)))
          .slice(0, MAX_PER_PERSON)
        const t = createTranslator(localeOf(person.locale))
        let delivered = 0

        for (const reminder of reminders) {
          delivered += await deps.notify(person.subscriptions, reminderMessage(reminder, t))
        }

        return delivered
      })
    } catch (error) {
      console.error('Reminders failed for one person:', error)
    }
  }

  return { people: recipients.length, sent }
}
