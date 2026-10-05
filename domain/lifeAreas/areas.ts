// Life areas (Projection spec §4): the parts of a life a person invests in.
// One area at most per goal, so totals never count twice. Pure rules.

export class LifeAreaRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'LifeAreaRuleError'
    this.field = field
  }
}

export const isLifeAreaRuleError = (error: unknown): error is LifeAreaRuleError => error instanceof LifeAreaRuleError

// The app's own colours and icons, so an area always looks right in light and
// dark, and nothing the person types ends up in a class name.
export const AREA_COLORS = ['blue', 'violet', 'orange', 'teal', 'rose', 'amber', 'green', 'slate'] as const
export const AREA_ICONS = ['code', 'music', 'book', 'heart', 'users', 'briefcase', 'sprout', 'star'] as const
export type AreaColor = (typeof AREA_COLORS)[number]
export type AreaIcon = (typeof AREA_ICONS)[number]

export const MAX_AREAS = 12

export type AreaInput = { name: string; statement: string | null; color: string | null; icon: string | null }

export function checkArea(input: AreaInput, others: { id?: string; name: string }[], id?: string): AreaInput {
  const name = input.name.trim()
  if (!name) throw new LifeAreaRuleError('Name the area.', 'name')
  if (name.length > 40) throw new LifeAreaRuleError('Keep it under 40 characters.', 'name')
  if (others.some((o) => o.id !== id && o.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new LifeAreaRuleError('You already have an area with this name.', 'name')
  }
  const statement = input.statement?.trim() || null
  if (statement && statement.length > 500) throw new LifeAreaRuleError('Keep it under 500 characters.', 'statement')
  if (input.color && !(AREA_COLORS as readonly string[]).includes(input.color)) throw new LifeAreaRuleError('Choose one of the colours.', 'color')
  if (input.icon && !(AREA_ICONS as readonly string[]).includes(input.icon)) throw new LifeAreaRuleError('Choose one of the icons.', 'icon')
  return { name, statement, color: input.color || null, icon: input.icon || null }
}

// The order after moving one area up or down; unchanged at the ends.
export function moved(ids: string[], id: string, direction: 'up' | 'down'): string[] {
  const i = ids.indexOf(id)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
