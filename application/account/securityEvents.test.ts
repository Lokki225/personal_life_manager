import { describe, expect, it, vi } from 'vitest'

import { getSecurityLog } from './securityEvents'

const repo = () => ({
  countsSince: vi.fn(async () => [
    { kind: 'limit.reached', count: 2 },
    { kind: 'signIn.failed', count: 9 },
  ]),
  recent: vi.fn(async () => []),
})

describe('getSecurityLog', () => {
  it('shows the week’s counts, most frequent first, to an administrator', async () => {
    const now = new Date(2026, 9, 10)
    const r = repo()
    const log = await getSecurityLog({ role: 'ADMIN' }, now, r)

    expect(log.week.map((row) => row.kind)).toEqual(['signIn.failed', 'limit.reached'])
    expect(r.countsSince).toHaveBeenCalledWith(new Date(2026, 9, 3))
  })

  it('shows nothing to anyone else', async () => {
    await expect(getSecurityLog({ role: 'USER' }, new Date(), repo())).rejects.toThrow('Only an administrator can do this.')
  })
})
