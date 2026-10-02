import {
  API_TOKEN_PREFIX,
  apiTokenRepository,
  type ApiScope,
  type ApiTokenOwner,
  type ApiTokenRepository,
} from '../../infrastructure/repositories/apiTokenRepository'
import { securityRepository, type SecurityRepository } from '../../infrastructure/repositories/securityRepository'
import { AccountRuleError } from './errors'

// Enough for a few assistants and scripts, few enough to keep track of.
export const MAX_API_TOKENS = 10

// How many requests one key may make per minute.
const REQUESTS_PER_MINUTE = 120
const MINUTE = 60 * 1000
// "Last used" is shown to the day; writing it on every request would be waste.
const USED_WRITE_INTERVAL = 60 * MINUTE

export async function createApiToken(
  userId: string,
  input: { name: string; scope: ApiScope },
  repository: Pick<ApiTokenRepository, 'createToken' | 'countTokens'> = apiTokenRepository,
): Promise<string> {
  if ((await repository.countTokens(userId)) >= MAX_API_TOKENS) {
    throw new AccountRuleError('You have the maximum number of keys. Delete one first.')
  }

  return repository.createToken(userId, input.name.trim(), input.scope)
}

export async function deleteApiToken(
  userId: string,
  id: string,
  repository: Pick<ApiTokenRepository, 'deleteToken'> = apiTokenRepository,
): Promise<void> {
  if (!(await repository.deleteToken(userId, id))) {
    throw new AccountRuleError('This key no longer exists.')
  }
}

export type ApiAccess =
  | { ok: true; owner: ApiTokenOwner }
  // 401: no key or an unknown one. 403: the key may not do this. 429: too fast.
  | { ok: false; status: 401 | 403 | 429; message: string }

type AccessDeps = {
  tokens: Pick<ApiTokenRepository, 'findOwner' | 'markUsed'>
  security: Pick<SecurityRepository, 'isLimited' | 'recordAttempt'>
}

const defaultAccessDeps: AccessDeps = { tokens: apiTokenRepository, security: securityRepository }

// Decides whether a request may go ahead: the key in its Authorization header
// must exist, be allowed to do what is asked, and not be going too fast.
export async function checkApiAccess(
  authorization: string | null,
  needs: ApiScope,
  deps: AccessDeps = defaultAccessDeps,
  now: Date = new Date(),
): Promise<ApiAccess> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]

  if (!token || !token.startsWith(API_TOKEN_PREFIX)) {
    return { ok: false, status: 401, message: 'Send your API key as "Authorization: Bearer <key>".' }
  }

  const owner = await deps.tokens.findOwner(token)

  if (!owner) {
    return { ok: false, status: 401, message: 'This API key is not valid. It may have been deleted.' }
  }

  if (needs === 'WRITE' && owner.scope !== 'WRITE') {
    return { ok: false, status: 403, message: 'This API key can only read. Create one that can also record.' }
  }

  const requests = `api:${owner.tokenId}`

  if (await deps.security.isLimited(requests, REQUESTS_PER_MINUTE, MINUTE, now)) {
    return { ok: false, status: 429, message: 'Too many requests. Wait a minute and try again.' }
  }

  await deps.security.recordAttempt(requests)

  if (!owner.lastUsedAt || now.getTime() - owner.lastUsedAt.getTime() > USED_WRITE_INTERVAL) {
    await deps.tokens.markUsed(owner.tokenId, now)
  }

  return { ok: true, owner }
}
