import { AccountRuleError } from '../account/errors'
import { appSettingRepository, type AppSettingRepository } from '../../infrastructure/repositories/appSettingRepository'

// Who the assistant is: a role written by the administrators for everyone,
// and, when they allow it, a few wishes of each person. Both are words for
// the model; the app's own rules always come first and win.

// What every assistant is told until an administrator writes something else.
export const DEFAULT_ROLE = `You are the money coach of Personal Life Manager. You help the person live on the plan they chose: spend within their daily budget, understand their overspends, grow their Buffer and savings, reach their goals and repay their debts on time.
- Be warm and encouraging, but honest: when they drift from their plan, say so early, with the figure that shows it.
- Prefer small, concrete steps to general advice: record today's lunch, put 2 000 XOF in the Buffer, review a subscription.
- Celebrate progress: a goal reached, a week within budget, a debt repaid.
- Stay on personal finance and this app. Politely decline other subjects.
- Do not give investment, tax or legal advice; suggest asking a qualified person.
- Never encourage borrowing to pay for everyday spending.`

export const MAX_NAME_LENGTH = 30
export const MAX_INSTRUCTIONS_LENGTH = 2000

const KEYS = {
  name: 'assistant.name',
  role: 'assistant.role',
  personalAllowed: 'assistant.personalAllowed',
} as const

// What the administrators decided, for everyone.
export type AppPersona = {
  name: string | null
  role: string
  // Whether the role is still the default one.
  isDefault: boolean
  // Whether each person may add their own instructions.
  personalAllowed: boolean
}

// What the model is told about itself in one conversation.
export type Persona = { name: string | null; role: string; personal: string | null }

const clean = (text: string | null | undefined, max: number) => text?.trim().slice(0, max) || null

export async function getAppPersona(
  repository: Pick<AppSettingRepository, 'getMany'> = appSettingRepository,
): Promise<AppPersona> {
  const settings = await repository.getMany(Object.values(KEYS))
  const role = clean(settings[KEYS.role], MAX_INSTRUCTIONS_LENGTH)

  return {
    name: clean(settings[KEYS.name], MAX_NAME_LENGTH),
    role: role ?? DEFAULT_ROLE,
    isDefault: role === null,
    personalAllowed: settings[KEYS.personalAllowed] !== 'false',
  }
}

// The persona of one person's assistant: their chosen name before the app's,
// and their own instructions only when the administrators allow them.
export function combinePersona(
  app: AppPersona,
  person: { assistantName: string | null; assistantInstructions: string | null },
): Persona {
  const own = app.personalAllowed

  return {
    name: (own ? clean(person.assistantName, MAX_NAME_LENGTH) : null) ?? app.name,
    role: app.role,
    personal: own ? clean(person.assistantInstructions, MAX_INSTRUCTIONS_LENGTH) : null,
  }
}

const ONLY_ADMINS = 'Only an administrator can change this.'

export async function saveAppPersona(
  actor: { role: string },
  input: { name?: string | null; role?: string | null; personalAllowed: boolean },
  repository: Pick<AppSettingRepository, 'set' | 'remove'> = appSettingRepository,
): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError(ONLY_ADMINS)
  }

  const name = clean(input.name, MAX_NAME_LENGTH)
  const role = clean(input.role, MAX_INSTRUCTIONS_LENGTH)

  await (name ? repository.set(KEYS.name, name) : repository.remove(KEYS.name))
  // An empty role, or the default one word for word, means "use the default":
  // a better default written later then reaches everyone.
  await (role && role !== DEFAULT_ROLE ? repository.set(KEYS.role, role) : repository.remove(KEYS.role))
  await repository.set(KEYS.personalAllowed, String(input.personalAllowed))
}

export async function resetAppRole(
  actor: { role: string },
  repository: Pick<AppSettingRepository, 'remove'> = appSettingRepository,
): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new AccountRuleError(ONLY_ADMINS)
  }

  await repository.remove(KEYS.role)
}

export async function savePersonalPersona(
  userId: string,
  input: { name?: string | null; instructions?: string | null },
  deps: {
    appPersona: () => Promise<AppPersona>
    save: (userId: string, persona: { name: string | null; instructions: string | null }) => Promise<void>
  },
): Promise<void> {
  if (!(await deps.appPersona()).personalAllowed) {
    throw new AccountRuleError('The administrators have turned off personal instructions.')
  }

  await deps.save(userId, {
    name: clean(input.name, MAX_NAME_LENGTH),
    instructions: clean(input.instructions, MAX_INSTRUCTIONS_LENGTH),
  })
}
