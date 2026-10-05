import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Career | Personal Life Manager',
}

export default function CareerReviewPage() {
  return <ComingLater title={m('Review')} text={m('What changed this week, and what changes next.')} />
}
