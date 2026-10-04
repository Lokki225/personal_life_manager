import { m } from '@/lib/i18n/translate'

import { ComingLater } from '../coming-later'

export default function PersonalJournalPage() {
  return (
    <ComingLater
      title={m('Journal')}
      text={m('What happened and what you think about it: daily notes, decisions and ideas, private when you want.')}
    />
  )
}
