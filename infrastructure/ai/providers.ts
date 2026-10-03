import { claudeModel } from './claude'
import type { AskModel } from './model'
import { openAiCompatibleModel } from './openaiCompatible'

// The AI providers the assistant can use. Each one is switched on by putting
// its key in the server's settings; its model can be changed the same way.
// Keys never leave the server and are never stored in the database.

export const PROVIDER_IDS = ['anthropic', 'openai', 'deepseek', 'gemini'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

type Provider = {
  id: ProviderId
  name: string
  keyVariable: string
  modelVariable: string
  defaultModel: string
  create: (apiKey: string, model: string) => AskModel
}

const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    keyVariable: 'ANTHROPIC_API_KEY',
    modelVariable: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-opus-5-5',
    create: claudeModel,
  },
  {
    id: 'openai',
    name: 'GPT',
    keyVariable: 'OPENAI_API_KEY',
    modelVariable: 'OPENAI_MODEL',
    defaultModel: 'gpt-5',
    create: (apiKey, model) =>
      openAiCompatibleModel({ baseUrl: 'https://api.openai.com/v1', apiKey, model, tokensField: 'max_completion_tokens' }),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    keyVariable: 'DEEPSEEK_API_KEY',
    modelVariable: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    create: (apiKey, model) => openAiCompatibleModel({ baseUrl: 'https://api.deepseek.com', apiKey, model }),
  },
  {
    id: 'gemini',
    name: 'Gemini',
    keyVariable: 'GEMINI_API_KEY',
    modelVariable: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.5-flash',
    create: (apiKey, model) =>
      openAiCompatibleModel({ baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey, model }),
  },
]

type Env = Record<string, string | undefined>

const modelOf = (provider: Provider, env: Env) =>
  env[provider.modelVariable] ||
  // The first setting, from when Claude was the only provider.
  (provider.id === 'anthropic' ? env.ASSISTANT_MODEL : undefined) ||
  provider.defaultModel

export type AvailableProvider = { id: ProviderId; name: string; model: string }

// The providers that have a key, in the order above.
export function availableProviders(env: Env = process.env): AvailableProvider[] {
  return PROVIDERS.filter((provider) => env[provider.keyVariable]).map((provider) => ({
    id: provider.id,
    name: provider.name,
    model: modelOf(provider, env),
  }))
}

export const isAssistantConfigured = (env: Env = process.env) => availableProviders(env).length > 0

// The provider a person chose, or the first available when theirs has no key
// (any more). Null when no provider has a key.
export function resolveProvider(preferred: string | null | undefined, env: Env = process.env): AvailableProvider | null {
  const available = availableProviders(env)

  return available.find((provider) => provider.id === preferred) ?? available[0] ?? null
}

// The model a person's assistant talks to.
export function modelFor(preferred: string | null | undefined, env: Env = process.env): AskModel {
  const chosen = resolveProvider(preferred, env)
  const provider = PROVIDERS.find((candidate) => candidate.id === chosen?.id)

  if (!chosen || !provider) {
    throw new Error('No AI provider has a key.')
  }

  return provider.create(env[provider.keyVariable]!, chosen.model)
}
