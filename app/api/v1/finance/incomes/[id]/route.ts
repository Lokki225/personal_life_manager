import { operations } from '@/application/api/operations'

import { route } from '../../../api'

export const PATCH = route(operations.editIncome)
export const DELETE = route(operations.deleteIncome)
