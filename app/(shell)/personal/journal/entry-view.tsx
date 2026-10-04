import Link from 'next/link'
import { Lock, Target } from 'lucide-react'

import type { VisibleEntry } from '@/application/personal/journal'
import { splitBody } from '@/domain/personal/journal'
import type { Translator } from '@/lib/i18n/translate'

import { ENTRY_TYPE_LABELS } from './entry-labels'

// An entry's text, with its links drawn as chips that open the goal or task.
export function EntryBody({ body }: { body: string }) {
  return (
    <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
      {splitBody(body).map((part, index) =>
        part.kind === 'text' ? (
          <span key={index}>{part.text}</span>
        ) : (
          <Link
            key={index}
            href={part.link.targetType === 'goal' ? `/personal/goals/${part.link.targetId}` : '/personal/tasks'}
            className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-node-accent/12 px-2 py-0.5 text-sm font-medium text-node-accent hover:underline"
          >
            {part.link.targetType === 'goal' ? <Target className="size-3.5" aria-hidden="true" /> : null}
            {part.link.label}
          </Link>
        ),
      )}
    </div>
  )
}

// One line of the timeline.
export function EntryCard({ entry, t }: { entry: VisibleEntry; t: Translator }) {
  return (
    <Link href={`/personal/journal/${entry.id}`} className="block space-y-1 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-node-accent/50">
      <p className="flex items-center gap-2 text-xs font-medium text-node-accent">
        {t(ENTRY_TYPE_LABELS[entry.type])}
        {entry.isSecured ? <Lock className="size-3.5 text-muted-foreground" aria-label={t('Locked')} /> : null}
      </p>
      {entry.locked ? (
        <p className="text-sm text-muted-foreground">{t('Locked entry')}</p>
      ) : (
        <>
          {entry.title ? <p className="font-semibold leading-snug">{entry.title}</p> : null}
          <p className="text-sm text-muted-foreground">{entry.preview}</p>
        </>
      )}
    </Link>
  )
}
