import { endpoint, ok } from '../../api'
import { chestsView } from '../../views'
import { financeState } from '../state'

export const GET = endpoint('READ', async (_request, user) => ok(chestsView((await financeState(user)).state)))
