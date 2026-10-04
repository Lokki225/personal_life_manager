'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { useT } from '@/lib/i18n/client'
import { nodeFromPath, viewFromPath } from '@/lib/nav/registry'
import { cn } from '@/lib/utils'

import { useNodeMemory } from './node-memory'
import { NodeSwitcher } from './node-switcher'

// Top of every node page: back, the node button and, on wide screens, where
// you are. The account and theme buttons sit on the right, outside this bar.
export function AppBar({ isAdmin }: { isAdmin: boolean }) {
  const t = useT()
  const pathname = usePathname()
  const node = nodeFromPath(pathname)

  if (!node) {
    return null
  }

  const view = viewFromPath(node, pathname)

  return (
    <div className="flex items-center gap-2 px-4 pt-4 pr-32 sm:px-6 sm:pr-36">
      <BackButton />
      <NodeSwitcher current={node} isAdmin={isAdmin} />
      {view ? (
        <p className="hidden truncate text-sm text-muted-foreground md:block">
          <span aria-hidden="true" className="mx-1">
            /
          </span>
          <span className="font-medium text-foreground">{t(view.label)}</span>
        </p>
      ) : null}
    </div>
  )
}

function BackButton() {
  const t = useT()
  const router = useRouter()
  const { previous } = useNodeMemory()
  const node = previous ? nodeFromPath(previous) : null
  const view = node && previous ? viewFromPath(node, previous) : null
  const label = !node
    ? t('No previous page')
    : view
      ? t('Back to {node} {view}', { node: t(node.label), view: t(view.label) })
      : t('Back to {node}', { node: t(node.label) })

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={!node}
      onClick={() => {
        if (node) {
          router.back()
        }
      }}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full border bg-card shadow-[var(--shadow-soft)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-node-accent/40',
        node ? 'hover:border-node-accent/50' : 'cursor-default opacity-40',
      )}
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
    </button>
  )
}
