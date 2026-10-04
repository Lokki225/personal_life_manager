'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { useT } from '@/lib/i18n/client'
import { canOpen, NODES, nodeFromPath, viewFromPath } from '@/lib/nav/registry'
import { cn } from '@/lib/utils'

import { LifeGraphOverlay } from './life-graph'
import { useNodeMemory } from './node-memory'
import { GraphTrigger, NodeSwitcher } from './node-switcher'
import { prefersReducedMotion, useMediaQuery } from './use-media-query'

// Shortcuts are ignored while typing.
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

// Top of every node page: back, the node button and, on wide screens, where
// you are and the life graph. The account and theme buttons sit on the right,
// outside this bar.
export function AppBar({ isAdmin }: { isAdmin: boolean }) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const { lastRoute } = useNodeMemory()
  const wide = useMediaQuery('(min-width: 768px)')
  const [graphOpen, setGraphOpen] = useState(false)
  const [origin, setOrigin] = useState({ x: 60, y: 36 })
  const trigger = useRef<HTMLButtonElement>(null)
  const node = nodeFromPath(pathname)

  const openGraph = useCallback(() => {
    // The graph grows from the centre of the node button.
    const box = trigger.current?.getBoundingClientRect()
    if (box) setOrigin({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    setGraphOpen(true)
  }, [])

  const closeGraph = useCallback(() => {
    setGraphOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }, [])

  // The graph shrinks back first; the new page arrives while it finishes.
  const goFromGraph = useCallback(
    (href: string) => {
      setGraphOpen(false)
      setTimeout(() => router.push(href), prefersReducedMotion() ? 0 : 380)
    },
    [router],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Escape' && graphOpen) {
        closeGraph()
        return
      }
      if (!wide) return

      if (event.key === 'g' || event.key === 'G') {
        event.preventDefault()
        if (graphOpen) closeGraph()
        else openGraph()
        return
      }

      const target = NODES[Number(event.key) - 1]
      if (/^[1-9]$/.test(event.key) && target && canOpen(target, isAdmin)) {
        event.preventDefault()
        if (graphOpen) goFromGraph(lastRoute(target.id))
        else router.push(lastRoute(target.id))
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wide, graphOpen, isAdmin, lastRoute, router, openGraph, closeGraph, goFromGraph])

  if (!node) {
    return null
  }

  const view = viewFromPath(node, pathname)

  return (
    <>
      <div className="flex items-center gap-2 px-4 pt-4 pr-32 sm:px-6 sm:pr-36">
        <BackButton />
        {wide ? (
          <GraphTrigger ref={trigger} current={node} expanded={graphOpen} onOpen={openGraph} />
        ) : (
          <NodeSwitcher current={node} isAdmin={isAdmin} />
        )}
        {view ? (
          <p className="hidden truncate text-sm text-muted-foreground md:block">
            <span aria-hidden="true" className="mx-1">
              /
            </span>
            <span className="font-medium text-foreground">{t(view.label)}</span>
            <span className="ml-3 hidden text-xs lg:inline">
              <kbd className="rounded border border-b-2 px-1.5 font-mono">G</kbd> {t('graph')}{' '}
              <kbd className="rounded border border-b-2 px-1.5 font-mono">1–4</kbd> {t('nodes')}
            </span>
          </p>
        ) : null}
      </div>
      {wide ? (
        <LifeGraphOverlay
          open={graphOpen}
          origin={origin}
          current={node}
          currentView={view?.id ?? null}
          isAdmin={isAdmin}
          onClose={closeGraph}
          onGo={goFromGraph}
        />
      ) : null}
    </>
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
