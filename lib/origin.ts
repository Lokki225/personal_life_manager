import { AsyncLocalStorage } from 'node:async_hooks'

// Who is acting in this request, when it is not the person in the app: the
// assistant, or a program with an API key. What is recorded while it acts is
// marked with it, so the history can say who did it.
//
// "assistant", "api:<name of the key>", or null for the person themselves and
// for what the app does on its own (closing days, the weekly transfer).

const origin = new AsyncLocalStorage<string | null>()

export function withOrigin<T>(who: string | null, task: () => T): T {
  return origin.run(who, task)
}

export function currentOrigin(): string | null {
  return origin.getStore() ?? null
}

// How an origin reads: who did it, and the key's name when it was a key.
export function describeOrigin(who: string | null | undefined): { by: 'assistant' | 'apiKey'; name: string | null } | null {
  if (who === 'assistant') {
    return { by: 'assistant', name: null }
  }

  if (who?.startsWith('api:')) {
    return { by: 'apiKey', name: who.slice(4) }
  }

  return null
}
