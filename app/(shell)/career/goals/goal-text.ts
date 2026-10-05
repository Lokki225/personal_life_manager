import type { Criterion } from '@/domain/career/criteria'
import type { ConditionResult, LevelCounts, Summary } from '@/domain/goals/engine'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import type { Translator } from '@/lib/i18n/translate'

import { ARRANGEMENT_LABELS, CONTRACT_LABELS, DIMENSION_LABELS, KIND_LABELS, LEVEL_LABELS, OPERATOR_LABELS } from '../labels'

// How a Career goal's criteria and results read, on the server and in the
// browser alike.

const amount = (t: Translator, dimension: string, value: number) =>
  dimension === 'weekly_hours' ? t('{hours} h', { hours: value }) : `${t.amount(value)} ${CURRENCY_CODE}`

export const choiceLabel = (t: Translator, value: string) => {
  const label = ARRANGEMENT_LABELS[value] ?? CONTRACT_LABELS[value]
  return label ? t(label) : value
}

// "Pay per month at least 600,000 XOF", "How you work: Remote / Hybrid"...
export function criterionText(t: Translator, criterion: Criterion | null): string {
  if (!criterion) return t('A criterion of another kind')
  switch (criterion.kind) {
    case 'number':
      return `${t(DIMENSION_LABELS[criterion.dimension])} ${t(OPERATOR_LABELS[criterion.operator])} ${amount(t, criterion.dimension, criterion.target)}`
    case 'choice':
      return `${t(DIMENSION_LABELS[criterion.dimension])}: ${criterion.accepted.map((v) => choiceLabel(t, v)).join(' / ')}`
    case 'evidence':
      return t('{kind} documented: {title}', { kind: t(KIND_LABELS[criterion.factKind]), title: criterion.match })
    case 'judgement':
      return criterion.label
  }
}

// What the value is now, when there is one to show.
export function valueText(t: Translator, criterion: Criterion | null, result: ConditionResult): string | null {
  if (result.result === 'UNKNOWN' || !criterion) return null
  if (criterion.kind === 'number' && typeof result.value === 'number') return amount(t, criterion.dimension, result.value)
  if (criterion.kind === 'choice' && typeof result.value === 'string') return choiceLabel(t, result.value)
  if (criterion.kind === 'evidence') return result.satisfied ? t('Documented or confirmed') : t('Not documented yet')
  return null
}

// Where the value comes from: "Current position: RPA Developer at Acme".
export function sourceText(t: Translator, describe: string | null): string | null {
  if (!describe) return null
  const [kind, ...rest] = describe.split(':')
  const title = rest.join(':')
  if (kind === 'position') return t('Current position: {title}', { title })
  if (kind === 'opportunity') return t('Opportunity: {title}', { title })
  if (kind === 'fact') return t('Fact: {title}', { title })
  return null
}

function countsText(t: Translator, counts: LevelCounts): string {
  const parts = [
    counts.met + counts.exceeds > 0 ? t.plural(counts.met + counts.exceeds, '{count} met', '{count} met') : null,
    counts.gap > 0 ? t.plural(counts.gap, '{count} gap', '{count} gaps') : null,
    counts.unknown > 0 ? t.plural(counts.unknown, '{count} unknown', '{count} unknown') : null,
    counts.reviewDue > 0 ? t.plural(counts.reviewDue, '{count} to review', '{count} to review') : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

// Counts per level, never a percentage: "Required: 2 gaps · Preferred: 1 unknown".
export function summaryLines(t: Translator, summary: Summary): string[] {
  return [
    countsText(t, summary.required) ? `${t(LEVEL_LABELS.REQUIRED)}: ${countsText(t, summary.required)}` : null,
    countsText(t, summary.preferred) ? `${t(LEVEL_LABELS.PREFERRED)}: ${countsText(t, summary.preferred)}` : null,
    summary.info > 0 ? `${t(LEVEL_LABELS.INFO)}: ${t.plural(summary.info, '{count} shown', '{count} shown')}` : null,
  ].filter((line): line is string => line !== null)
}
