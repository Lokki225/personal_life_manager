import { endpoint, ok } from '../../api'
import { goalsView } from '../../views'
import { financeState } from '../state'

export const GET = endpoint('READ', async (_request, user) => ok(goalsView((await financeState(user)).state)))
