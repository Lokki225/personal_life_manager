import { endpoint, ok } from '../../api'
import { planView } from '../../views'
import { financeState } from '../state'

export const GET = endpoint('READ', async (_request, user) => ok(planView((await financeState(user)).state)))
