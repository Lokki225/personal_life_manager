import type { FeedbackKind } from '@/application/account/feedback'
import { m } from '@/lib/i18n/translate'

// How each kind of opinion is named on the screen.
export const KIND_LABELS: Record<FeedbackKind, string> = {
  idea: m('An idea'),
  problem: m('A problem'),
  praise: m('Something I like'),
  other: m('Something else'),
}
