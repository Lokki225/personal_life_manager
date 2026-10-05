import { operations } from '@/application/api/operations'

import { route } from '../../api'

export const GET = route(operations.getCareerGoals)
export const POST = route(operations.addCareerGoal)
