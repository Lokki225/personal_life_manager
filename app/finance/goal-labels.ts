// Plain-language names for goal measurements and comparisons, shared by the
// goal builder, the Goals page and the Review page.
export const MEASUREMENT_LABELS: Record<string, string> = {
  chest_balance: 'Chest balance',
  monthly_deviation_count: 'Exceptions this month',
  monthly_deviation_amount: 'Overspend this month',
}

export const OPERATOR_LABELS: Record<string, string> = {
  GTE: 'at least',
  GT: 'more than',
  LTE: 'at most',
  LT: 'less than',
  EQ: 'exactly',
}

export const measurementLabel = (measurement: string) =>
  MEASUREMENT_LABELS[measurement] ?? measurement.replace(/_/g, ' ')

export const operatorLabel = (operator: string) => OPERATOR_LABELS[operator] ?? operator
