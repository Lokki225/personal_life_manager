'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useT } from '@/lib/i18n/client'
import { nodeFromPath, viewFromPath } from '@/lib/nav/registry'
import { cn } from '@/lib/utils'

import { NodeIcon } from './node-icon'

// The views of the current node. Hidden on a node page that is none of its
// views (Finance setup), where leaving halfway would not make sense.
export function BottomTabs() {
  const t = useT()
  const pathname = usePathname()
  const node = nodeFromPath(pathname)
  const active = node ? viewFromPath(node, pathname) : null

  if (!node || !active) {
    return null
  }

  return (
    <nav
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2"
      aria-label={t('{node} views', { node: t(node.label) })}
    >
      <div className="flex items-center gap-1 rounded-2xl border bg-card/90 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-md">
        {node.views.map((view) => {
          const isActive = view.id === active.id

          return (
            <Link
              key={view.id}
              href={view.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-node-accent/40',
                isActive ? 'bg-node-accent text-on-node-accent' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <NodeIcon name={view.icon} className="size-5" />
              <span className="max-w-full truncate">{t(view.label)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
