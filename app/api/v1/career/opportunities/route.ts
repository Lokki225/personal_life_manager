import { operations } from '@/application/api/operations'

import { route } from '../../api'

export const GET = route(operations.getCareerOpportunities)
export const POST = route(operations.addCareerOpportunity)
