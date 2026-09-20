export function validateExpenseInput(amount: number, category?: string | null) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Please enter a valid amount greater than zero.'
  }

  if (!category || !String(category).trim()) {
    return 'Please select a category for this expense.'
  }

  return null
}
