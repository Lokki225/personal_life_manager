import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Career | Personal Life Manager',
}

export default function CareerGoalsPage() {
  return <ComingLater title={m('Goals')} text={m('What you want next, by your own criteria, compared with where you stand.')} />
}
