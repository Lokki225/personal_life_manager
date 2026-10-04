import { m } from '@/lib/i18n/translate'

// Plain-language names for goal measurements and comparisons, shared by the
// goal builder, the Goals page and the Review page. They are English: pass
// them through the translator before showing them.
export const MEASUREMENT_LABELS: Record<string, string> = {
  chest_balance: m('Chest balance'),
  monthly_deviation_count: m('Exceptions this month'),
  monthly_deviation_amount: m('Overspend this month'),
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

export const operatorLabel = (operator: string) => OPERATOR_LABELS[operator] ?? operator
