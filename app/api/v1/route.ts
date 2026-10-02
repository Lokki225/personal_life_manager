import { endpoint, ok } from './api'

// The map of the API, for a program finding its way.
export const GET = endpoint('READ', async () =>
  ok({
    name: 'Personal Life Manager API',
    version: 'v1',
    documentation: 'docs/api.md in the repository',
    endpoints: [
      { method: 'GET', path: '/api/v1/me', needs: 'read', does: 'Who the key belongs to.' },
      { method: 'GET', path: '/api/v1/finance/today', needs: 'read', does: 'Today: budget, spending, what is left.' },
      { method: 'GET', path: '/api/v1/finance/plan', needs: 'read', does: 'Incomes and allocations.' },
      { method: 'GET', path: '/api/v1/finance/chests', needs: 'read', does: 'Chests and their balances.' },
      { method: 'GET', path: '/api/v1/finance/goals', needs: 'read', does: 'Goals and their progress.' },
      { method: 'GET', path: '/api/v1/finance/debts', needs: 'read', does: 'Debts and loans.' },
      { method: 'GET', path: '/api/v1/finance/history', needs: 'read', does: 'What was recorded, newest first.' },
      { method: 'GET', path: '/api/v1/finance/review', needs: 'read', does: 'Planned against actual for a period.' },
      { method: 'POST', path: '/api/v1/finance/expenses', needs: 'record', does: 'Record an expense made today.' },
      { method: 'PATCH', path: '/api/v1/finance/expenses/{id}', needs: 'record', does: 'Correct an expense of today.' },
      { method: 'DELETE', path: '/api/v1/finance/expenses/{id}', needs: 'record', does: 'Delete an expense of today.' },
      { method: 'POST', path: '/api/v1/finance/savings', needs: 'record', does: 'Put part of what is left today in a chest.' },
      { method: 'POST', path: '/api/v1/notifications', needs: 'record', does: 'Send a notification to the devices of the owner.' },
    ],
  }),
)
