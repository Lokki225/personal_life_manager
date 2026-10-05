import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Projection | Personal Life Manager',
}

export default function ProjectionDecisionsPage() {
  return <ComingLater title={m('Decisions')} text={m('Real choices between options, side by side, looked at again later.')} />
}
