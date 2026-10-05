import type { Momentum, ProjectKind, ProjectStatus } from '@/domain/projects/projects'
import type { Translator } from '@/lib/i18n/translate'
import { m } from '@/lib/i18n/translate'

// Plain-language names for projects. English: pass them through the
// translator before showing them.

export const KIND_LABELS: Record<ProjectKind, string> = {
  SOFTWARE: m('Software'),
  MUSIC: m('Music'),
  WRITING: m('Writing'),
  TRAINING: m('Training'),
  DESIGN: m('Design'),
  BUSINESS: m('Business'),
  OTHER: m('Other'),
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: m('Planning'),
  ACTIVE: m('Active'),
  PAUSED: m('Paused'),
  SHIPPED: m('Shipped'),
  MAINTAINED: m('Maintained'),
  ARCHIVED: m('Archived'),
}

export const DOMAIN_LABELS = { personal: m('Personal'), career: m('Career') } as const

// Momentum as words, never as an alarm (projects spec §6.6).
export function momentumText(t: Translator, momentum: Momentum): string {
  switch (momentum.kind) {
    case 'active':
      return t('Active this week')
    case 'recent':
      return t('Last active {count} days ago', { count: momentum.days })
    case 'quiet':
      return t('Quiet for {count} days', { count: momentum.days })
    case 'paused':
      return t('Paused')
    case 'archived':
      return t('Archived')
    case 'none':
      return t('Nothing recorded yet')
  }
}

// A date as the value of a date field.
export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
