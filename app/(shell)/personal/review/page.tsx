import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../coming-later'

export default function PersonalReviewPage() {
  return (
    <ComingLater
      title={m('Review')}
      text={m('Your week at a glance: tasks done and carried over, and why they slipped.')}
    />
  )
}
