import { listDebtsWithStatus } from '@/application/finance/debts'

import { endpoint, ok } from '../../api'
import { debtsView } from '../../views'

export const GET = endpoint('READ', async (_request, user) => ok(debtsView(await listDebtsWithStatus(user.id))))
