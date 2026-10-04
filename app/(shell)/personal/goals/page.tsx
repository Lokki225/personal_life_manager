import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../coming-later'

export default function PersonalGoalsPage() {
  return (
    <ComingLater
      title={m('Goals')}
      text={m('Goals you grow into: a rating to reach, a language to learn, a habit to keep. Your tasks will count towards them.')}
    />
  )
}
