import { operations } from '@/application/api/operations'

import { route } from '../../../api'

export const PATCH = route(operations.editAllocation)
export const DELETE = route(operations.deleteAllocation)
