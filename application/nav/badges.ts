import { CURRENCY_CODE } from '../../domain/finance/calculations'
import type { Translator } from '../../lib/i18n/translate'
import type { NodeId } from '../../lib/nav/registry'
import { recomputeFinanceState } from '../finance/recomputeFinanceState'
import { getTodayTasks } from '../personal/tasks'

// One live line per node for the life graph (overlay spec §9). A node that
// fails gives null and the others still answer.

export type Badges = Record<NodeId, string | null>

const MAX_LENGTH = 24

const shorten = (text: string) => (text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text)

async function safely(read: () => Promise<string | null>): Promise<string | null> {
  try {
    const text = await read()
    return text ? shorten(text) : null
  } catch (error) {
    console.error('Badge failed:', error)
    return null
  }
}

export async function getBadges(userId: string, open: (id: NodeId) => boolean, t: Translator, now: Date): Promise<Badges> {
  const [finance, personal] = await Promise.all([
    open('finance')
      ? safely(async () => {
          const state = await recomputeFinanceState({ userId, referenceDate: now })
          return state.dailyBudget > 0 ? t('{amount} left today', { amount: `${t.amount(state.dailyRemaining)} ${CURRENCY_CODE}` }) : null
        })
      : null,
    open('personal')
      ? safely(async () => {
          const { entries } = await getTodayTasks(userId, now)
          const left = entries.filter((e) => !e.done).length
          return t.plural(left, '{count} task open', '{count} tasks open')
        })
      : null,
  ])

  return { finance, personal, career: null, projection: null }
}
