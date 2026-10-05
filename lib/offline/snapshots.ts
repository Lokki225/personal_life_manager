// What each screen readable offline keeps on the device: plain JSON, built on
// the server from what the page already loaded, saved after every online visit.

export const SNAPSHOT_KEYS = ['finance.today', 'finance.review', 'personal.today', 'personal.review'] as const
export type SnapshotKey = (typeof SNAPSHOT_KEYS)[number]

export type FinanceTodaySnapshot = {
  // yyyy-mm-dd, on the person's clock.
  day: string
  budget: number
  spent: number
  saved: number
  monthSpent: number
  monthBudget: number
  totalSaved: number
  expenses: { amount: number; category: string; description: string | null; paidFromChest: string | null }[]
  chests: { name: string; balance: number }[]
  goals: { name: string; satisfied: boolean }[]
}

export type FinanceReviewSnapshot = {
  period: string
  plannedBudget: number
  actualSpent: number
  remaining: number
  actualSavings: number
  exceptionCount: number
  categories: { category: string; total: number }[]
  goals: { name: string; satisfied: boolean }[]
}

export type PersonalTodaySnapshot = {
  day: string
  planned: number
  done: number
  capacity: number
  tasks: { id: string; title: string; done: boolean; repeats: boolean; carryCount: number; category: string | null }[]
  sessionMinutes: number
  dailyNote: string | null
}

export type PersonalReviewSnapshot = {
  start: string
  end: string
  tasksDone: number
  slips: number
  reasons: { reason: string; count: number }[]
  sessionMinutes: number
  byGoal: { goal: string | null; minutes: number }[]
  onTrack: string[]
  behind: string[]
  achieved: string[]
  habitsKept: string[]
  habitsSlipping: string[]
}

export type SnapshotData = {
  'finance.today': FinanceTodaySnapshot
  'finance.review': FinanceReviewSnapshot
  'personal.today': PersonalTodaySnapshot
  'personal.review': PersonalReviewSnapshot
}

export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// The screen a path shows offline, or null when it has none.
export function snapshotKeyFor(pathname: string): SnapshotKey | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/finance' || path === '/finance/today') return 'finance.today'
  if (path === '/finance/review') return 'finance.review'
  if (path === '/personal' || path === '/personal/today') return 'personal.today'
  if (path === '/personal/review') return 'personal.review'
  return null
}

export const SNAPSHOT_PATHS: Record<SnapshotKey, string> = {
  'finance.today': '/finance',
  'finance.review': '/finance/review',
  'personal.today': '/personal/today',
  'personal.review': '/personal/review',
}

// Old enough to warn about strongly (offline spec §9).
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
