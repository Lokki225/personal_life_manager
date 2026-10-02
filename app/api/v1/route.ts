import { operationList } from '@/application/api/operations'

import { endpoint, ok } from './api'

// The map of the API, for a program finding its way.
export const GET = endpoint('READ', async () =>
  ok({
    name: 'Personal Life Manager API',
    version: 'v1',
    documentation: 'docs/api.md in the repository',
    endpoints: operationList.map((operation) => ({
      method: operation.method,
      path: `/api/v1${operation.path}`,
      needs: operation.needs === 'WRITE' ? 'record' : 'read',
      does: operation.does,
    })),
  }),
)
