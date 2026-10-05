import type { GoalCondition, Level } from '../goals/engine'
import { CareerRuleError } from './errors'
import { CONTRACT_TYPES, FACT_KINDS, WORK_ARRANGEMENTS, type FactKind } from './situation'

// A Career goal's criteria (Career spec §6), as the person thinks of them,
// and the shared-engine conditions they are stored as.
//
//   number    POSITION_DIMENSION  pay or hours   GTE / LTE / EQ  target
//   choice    POSITION_DIMENSION  arrangement, contract, place     IN accepted values
//   evidence  FACT_EVIDENCE       a documented fact by kind and title
//   judgement JUDGEMENT           your own verdict

export const NUMBER_DIMENSIONS = ['monthly_compensation', 'weekly_hours'] as const
export const CHOICE_DIMENSIONS = ['work_arrangement', 'contract_type', 'location'] as const
export type NumberDimension = (typeof NUMBER_DIMENSIONS)[number]
export type ChoiceDimension = (typeof CHOICE_DIMENSIONS)[number]
export type Dimension = NumberDimension | ChoiceDimension

export const LEVELS = ['REQUIRED', 'PREFERRED', 'INFO'] as const

export type Criterion =
  | { kind: 'number'; level: Level; dimension: NumberDimension; operator: 'GTE' | 'LTE' | 'EQ'; target: number }
  | { kind: 'choice'; level: Level; dimension: ChoiceDimension; accepted: string[] }
  | { kind: 'evidence'; level: Level; factKind: FactKind; match: string }
  | { kind: 'judgement'; level: Level; label: string }

const base = { aggregation: 'LATEST' as const, window: { type: 'ALL_TIME' as const } }

// The values a choice may accept: fixed lists, or the person's places.
export function choicesFor(dimension: ChoiceDimension, places: string[]): readonly string[] {
  return dimension === 'work_arrangement' ? WORK_ARRANGEMENTS : dimension === 'contract_type' ? CONTRACT_TYPES : places
}

// Checks a criterion; throws a CareerRuleError naming the field.
export function checkCriterion(criterion: Criterion, places: string[]): Criterion {
  switch (criterion.kind) {
    case 'number': {
      const max = criterion.dimension === 'weekly_hours' ? 168 : 999_999_999_999
      if (!Number.isFinite(criterion.target) || criterion.target < 0 || criterion.target > max) {
        throw new CareerRuleError(criterion.dimension === 'weekly_hours' ? 'Enter between 0 and 168 hours.' : 'Enter an amount, for example 600000.', 'target')
      }
      return criterion
    }
    case 'choice': {
      const allowed = choicesFor(criterion.dimension, places).map((v) => v.toLowerCase())
      const accepted = [...new Set(criterion.accepted.map((v) => v.trim()).filter(Boolean))]
      if (accepted.length === 0) throw new CareerRuleError('Choose at least one.', 'accepted')
      if (accepted.some((v) => !allowed.includes(v.toLowerCase()))) throw new CareerRuleError('Choose among the listed values.', 'accepted')
      return { ...criterion, accepted }
    }
    case 'evidence': {
      const match = criterion.match.trim()
      if (!(FACT_KINDS as readonly string[]).includes(criterion.factKind)) throw new CareerRuleError('Choose what it is.', 'factKind')
      if (!match) throw new CareerRuleError('Name the skill, qualification or experience.', 'match')
      if (match.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'match')
      return { ...criterion, match }
    }
    case 'judgement': {
      const label = criterion.label.trim()
      if (!label) throw new CareerRuleError('Say what you will judge.', 'label')
      if (label.length > 160) throw new CareerRuleError('Keep it under 160 characters.', 'label')
      return { ...criterion, label }
    }
  }
}

export function conditionOf(criterion: Criterion): Omit<GoalCondition, 'id'> {
  switch (criterion.kind) {
    case 'number':
      return {
        ...base,
        source: 'POSITION_DIMENSION',
        sourceRef: { dimension: criterion.dimension },
        operator: criterion.operator,
        target: criterion.target,
        unit: criterion.dimension === 'weekly_hours' ? 'h' : 'XOF',
        level: criterion.level,
      }
    case 'choice':
      return {
        ...base,
        source: 'POSITION_DIMENSION',
        sourceRef: { dimension: criterion.dimension },
        operator: 'IN',
        target: 0,
        acceptedValues: criterion.accepted,
        level: criterion.level,
      }
    case 'evidence':
      return {
        ...base,
        source: 'FACT_EVIDENCE',
        sourceRef: { factKind: criterion.factKind, match: criterion.match },
        operator: 'EQ',
        target: 1,
        level: criterion.level,
      }
    case 'judgement':
      return { ...base, source: 'JUDGEMENT', sourceRef: {}, operator: 'EQ', target: 1, label: criterion.label, level: criterion.level }
  }
}

// The criterion a stored condition stands for, or null when it is not one
// Career knows.
export function criterionOf(condition: GoalCondition): Criterion | null {
  const level = condition.level ?? 'REQUIRED'
  const ref = condition.sourceRef
  if (condition.source === 'POSITION_DIMENSION') {
    const dimension = ref.dimension
    if ((NUMBER_DIMENSIONS as readonly unknown[]).includes(dimension) && condition.operator !== 'IN' && condition.operator !== 'GT' && condition.operator !== 'LT') {
      return { kind: 'number', level, dimension: dimension as NumberDimension, operator: condition.operator, target: condition.target }
    }
    if ((CHOICE_DIMENSIONS as readonly unknown[]).includes(dimension) && condition.operator === 'IN') {
      return { kind: 'choice', level, dimension: dimension as ChoiceDimension, accepted: condition.acceptedValues ?? [] }
    }
    return null
  }
  if (condition.source === 'FACT_EVIDENCE' && typeof ref.factKind === 'string' && typeof ref.match === 'string') {
    return { kind: 'evidence', level, factKind: ref.factKind as FactKind, match: ref.match }
  }
  if (condition.source === 'JUDGEMENT') return { kind: 'judgement', level, label: condition.label ?? '' }
  return null
}
