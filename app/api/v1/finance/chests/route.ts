import { operations } from '@/application/api/operations'

import { route } from '../../api'

export const GET = route(operations.getChests)
export const POST = route(operations.createChest)
