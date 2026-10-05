import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Projection | Personal Life Manager',
}

export default function ProjectionExperimentsPage() {
  return <ComingLater title={m('Experiments')} text={m('Small, time-boxed tests that turn "maybe" into what happened.')} />
}
