import type { Translator } from '@/lib/i18n/translate'
import { m } from '@/lib/i18n/translate'

// Plain-language names for goal measurements and comparisons, shared by the
// goal builder, the Goals page and the Review page. They are English: pass
// them through the translator before showing them.
export const MEASUREMENT_LABELS: Record<string, string> = {
  chest_balance: m('Chest balance'),
  total_savings: m('Total savings'),
  monthly_saved: m('Saved this month'),
  monthly_spending: m('Spending this month'),
  monthly_category_spending: m('Spending in a category this month'),
  monthly_deviation_count: m('Exceptions this month'),
  monthly_deviation_amount: m('Overspend this month'),
  debt_owed: m('Debt still owed'),
}

export const OPERATOR_LABELS: Record<string, string> = {
  GTE: m('at least'),
  GT: m('more than'),
  LTE: m('at most'),
  LT: m('less than'),
  EQ: m('exactly'),
}

export const measurementLabel = (measurement: string) =>
  MEASUREMENT_LABELS[measurement] ?? measurement.replace(/_/g, ' ')

// A condition's name, translated, with its category when it has one.
export function conditionLabel(t: Translator, condition: { measurement: string; category?: string | null }) {
  return condition.measurement === 'monthly_category_spending' && condition.category
    ? t('Spending on {category} this month', { category: t(condition.category) })
    : t(measurementLabel(condition.measurement))
}

export const operatorLabel = (operator: string) => OPERATOR_LABELS[operator] ?? operator
