import { operations } from '@/application/api/operations'

import { route } from '../../../api'

export const PATCH = route(operations.editExpense)
export const DELETE = route(operations.deleteExpense)
