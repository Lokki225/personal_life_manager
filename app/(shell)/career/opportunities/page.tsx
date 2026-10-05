import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Career | Personal Life Manager',
}

export default function CareerOpportunitiesPage() {
  return <ComingLater title={m('Opportunities')} text={m('Offers and openings, compared with what you want, side by side.')} />
}
