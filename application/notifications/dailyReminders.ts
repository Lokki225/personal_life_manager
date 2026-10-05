import { careerReminders, type CareerReminder, type CareerReminderFacts } from '../../domain/career/reminders'
import { mondayOf } from '../../domain/career/week'
import { CURRENCY_CODE } from '../../domain/finance/calculations'
import { eveningReminders, type Reminder } from '../../domain/finance/reminders'
import type { PushMessage } from '../../infrastructure/push/sendPush'
import { careerOpportunityRepository } from '../../infrastructure/repositories/careerOpportunityRepository'
import { careerRepository } from '../../infrastructure/repositories/careerRepository'
import { careerWeekRepository } from '../../infrastructure/repositories/careerWeekRepository'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { notificationRepository } from '../../infrastructure/repositories/notificationRepository'
import { pushRepository, type PushRecipient } from '../../infrastructure/repositories/pushRepository'
import { now as clockNow, withClockZone } from '../../lib/clock'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../lib/i18n/config'
import { createTranslator, type Translator } from '../../lib/i18n/translate'
import { listCareerGoals } from '../career/goals'
import { getSituation } from '../career/situation'
import { listPendingIncomes } from '../finance/confirmIncome'
import { listDebtsWithStatus } from '../finance/debts'
import { recomputeFinanceState } from '../finance/recomputeFinanceState'
import { reachedSavingsGoals } from './instant'
import { notifyDevices } from './notify'

// Never more than this many notifications for one person in one run.
const MAX_PER_PERSON = 3

type ReminderFacts = Omit<Parameters<typeof eveningReminders>[0], 'today'>

type Deps = {
  listRecipients: () => Promise<PushRecipient[]>
  // What is true for one person right now, on their own clock.
  factsFor: (userId: string, today: Date) => Promise<ReminderFacts>
  careerFactsFor?: (userId: string, today: Date) => Promise<Omit<CareerReminderFacts, 'today'>>
  // Notes that this was sent; false when it already was.
  claim: (userId: string, key: string) => Promise<boolean>
  notify: typeof notifyDevices
}

// The weekly transfers this run can still announce: made since about the last run.
const SWEEP_WINDOW = 25 * 60 * 60 * 1000

const defaultDeps: Deps = {
  listRecipients: pushRepository.listRecipients,
  factsFor: async (userId, today) => {
    const [state, pendingIncomes, debts, movements] = await Promise.all([
      recomputeFinanceState({ userId, referenceDate: today }),
      listPendingIncomes(userId, today),
      listDebtsWithStatus(userId),
      financeRepository.listMovements(userId),
    ])
    const since = new Date(Date.now() - SWEEP_WINDOW)

    return {
      hasPlan: state.incomes.length > 0,
      expensesToday: state.dailyExpenses.length,
      pendingIncomes,
      debts,
      // On a 31st the day is paid out of the chests and cannot go over.
      overspend: state.uncoveredDay
        ? undefined
        : { amount: Math.floor(state.dailyOverspend), explained: state.overspendExplained },
      month: { spent: state.monthlySpent, budget: state.periodBudget },
      sweeps: movements
        .filter((movement) => movement.reason === 'BUFFER_CONSOLIDATION' && movement.createdAt >= since)
        .map((movement) => ({ id: movement.id, amount: Number(movement.amount) })),
      goalsReached: reachedSavingsGoals(state.goals),
      lockedChests: state.chests.flatMap((chest) =>
        chest.type === 'SECURE' && chest.lockedUntil ? [{ id: chest.id, name: chest.name, lockedUntil: chest.lockedUntil }] : [],
      ),
      dailyBudget: state.dailyBudget - state.coveredToday,
    }
  },
  careerFactsFor: async (userId, today) => {
    const [opportunities, focus, reviewDay, goals, situation] = await Promise.all([
      careerOpportunityRepository.list(userId),
      careerWeekRepository.listFocus(userId, mondayOf(today)),
      careerRepository.getReviewDay(userId),
      listCareerGoals(userId, today),
      getSituation(userId, today),
    ])
    // Paused goals and closed ones stay quiet.
    const active = goals.filter((g) => !['ACHIEVED', 'ABANDONED', 'SUPERSEDED', 'PAUSED'].includes(g.evaluation.status))
    return {
      opportunities: opportunities.filter((o) => o.status !== 'CLOSED').map((o) => ({ id: o.id, title: o.title, deadline: o.deadline })),
      openFocus: focus.filter((f) => f.status === 'OPEN').length,
      reviewDay,
      dueForReview:
        active.reduce((sum, g) => sum + g.evaluation.summary.required.reviewDue + g.evaluation.summary.preferred.reviewDue, 0) +
        Object.values(situation.byKind)
          .flat()
          .filter((f) => f.reviewDue).length,
    }
  },
  claim: notificationRepository.claim,
  notify: notifyDevices,
}

// The words of one Career reminder, in the person's language.
export function careerReminderMessage(reminder: CareerReminder, t: Translator): PushMessage {
  switch (reminder.kind) {
    case 'opportunityDeadline':
      return {
        title: reminder.daysLeft === 1 ? t('{title}: the deadline is tomorrow', { title: reminder.title }) : t('{title}: the deadline is in 2 days', { title: reminder.title }),
        body: t('Reply, apply or let it go: say where it stands.'),
        url: `/career/opportunities/${reminder.opportunityId}`,
      }
    case 'weeklyReview':
      return {
        title: t('Your Career week'),
        body: t.plural(reminder.openFocus, '{count} focus item is still open. A look back at the week?', '{count} focus items are still open. A look back at the week?'),
        url: '/career/review',
      }
    case 'reviewDue':
      return {
        title: t('Is your situation still right?'),
        body: t.plural(reminder.count, '{count} fact or judgement has not been looked at for a while.', '{count} facts or judgements have not been looked at for a while.'),
        url: '/career/goals',
      }
  }
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
    case 'overspendUnexplained':
      return {
        title: t('Today went {amount} over budget', { amount: money(reminder.amount) }),
        body: t('Say why, or cover it from the Buffer, before the day ends.'),
        url: '/finance',
      }
    case 'monthPace':
      return reminder.threshold === 100
        ? {
            title: t("This month's budget is used up"),
            body: t.plural(
              reminder.daysLeft,
              '{count} day is left. What you spend now goes beyond the plan.',
              '{count} days are left. What you spend now goes beyond the plan.',
            ),
            url: '/finance/review',
          }
        : {
            title: t("You have used 80% of this month's budget"),
            body: t('Only {share}% of the month has passed. Slowing down now keeps the month on plan.', {
              share: reminder.elapsedShare,
            }),
            url: '/finance/review',
          }
    case 'bufferSwept':
      return {
        title: t('{amount} moved to your Base Chest', { amount: money(reminder.amount) }),
        body: t("The week's leftovers left the Buffer for the Base Chest."),
        url: '/finance/chests',
      }
    case 'goalReached':
      return {
        title: t('Goal reached: {name}', { name: reminder.name }),
        body: t('Its chest has reached its target. Well done!'),
        url: '/finance/goals',
      }
    case 'chestUnlocks':
      return {
        title: t('{chest} unlocks tomorrow', { chest: t(reminder.name) }),
        body: t('From tomorrow, the money in it can be used.'),
        url: '/finance/chests',
      }
    case 'monthStart':
      return {
        title: t('A new month begins'),
        body: t('Your daily budget this month is {amount}.', { amount: money(reminder.dailyBudget) }),
        url: '/finance',
      }
  }
}

const localeOf = (locale: string | null): Locale =>
  LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE

// Runs once a day. For each person with a device to notify who wants money
// reminders, works out on their own clock what is worth telling, most
// important first, and sends it in their language. What was already sent
// (by an earlier run, or the moment it happened) is not sent again.
// Those in `notedToday` already got the assistant's note, which covers the
// reminder to record their spending.
export async function sendDailyReminders(
  deps: Deps = defaultDeps,
  notedToday: ReadonlySet<string> = new Set(),
): Promise<{ people: number; sent: number }> {
  const recipients = await deps.listRecipients()
  let sent = 0

  for (const person of recipients) {
    const career = Boolean(person.notifyCareer) && deps.careerFactsFor !== undefined
    if (!person.notifyMoney && !career) {
      continue
    }

    // One person's trouble must not stop the reminders of everyone after them.
    try {
      sent += await withClockZone(person.timeZone, async () => {
        const today = clockNow()
        const t = createTranslator(localeOf(person.locale))
        const money = person.notifyMoney
          ? eveningReminders({ today, ...(await deps.factsFor(person.id, today)) })
              .filter((reminder) => !(reminder.kind === 'recordSpending' && notedToday.has(person.id)))
              .map((reminder) => ({ key: reminder.key, message: () => reminderMessage(reminder, t) }))
          : []
        const careerOnes = career
          ? careerReminders({ today, ...(await deps.careerFactsFor!(person.id, today)) }).map((reminder) => ({
              key: reminder.key,
              message: () => careerReminderMessage(reminder, t),
            }))
          : []
        let delivered = 0
        let told = 0

        // Money first; the same daily cap covers both.
        for (const reminder of [...money, ...careerOnes]) {
          if (told >= MAX_PER_PERSON) {
            break
          }

          if (!(await deps.claim(person.id, reminder.key))) {
            continue
          }

          told += 1
          delivered += await deps.notify(person.subscriptions, reminder.message())
        }

        return delivered
      })
    } catch (error) {
      console.error('Reminders failed for one person:', error)
    }
  }

  return { people: recipients.length, sent }
}
