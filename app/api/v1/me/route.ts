import { fullName, shortName } from '@/lib/greeting'

import { endpoint, ok } from '../api'

export const GET = endpoint('READ', async (_request, user) =>
  ok({
    id: user.id,
    name: fullName(user),
    // The name to greet the person with.
    callName: shortName(user),
    email: user.email,
    // The language to write to them in: 'fr', 'en', or null when unknown.
    language: user.locale,
    timeZone: user.timeZone,
  }),
)
