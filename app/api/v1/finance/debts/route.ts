import { operations } from '@/application/api/operations'

import { route } from '../../api'

export const GET = route(operations.getDebts)
export const POST = route(operations.recordDebt)
