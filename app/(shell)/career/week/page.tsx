import type { Metadata } from 'next'

import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../../coming-later'

export const metadata: Metadata = {
  title: 'Career | Personal Life Manager',
}

export default function CareerWeekPage() {
  return <ComingLater title={m('Week')} text={m('Your focus for the week, a quick log and what is coming up.')} />
}
