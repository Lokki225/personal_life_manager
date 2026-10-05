import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Projection | Personal Life Manager',
}

export default function ProjectionIdeasPage() {
  return <ComingLater title={m('Ideas')} text={m('Capture an idea in one line, explore it, test it, and decide.')} />
}
