'use client'

import type { CSSProperties, Ref } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Waypoints } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { useT } from '@/lib/i18n/client'
import { canOpen, getNode, NODES, viewFromPath, type NodeDef, type NodeId } from '@/lib/nav/registry'
import { cn } from '@/lib/utils'

import { NodeIcon } from './node-icon'
import { useNodeMemory } from './node-memory'

export const accentOf = (id: NodeId) => ({ '--node-accent': `var(--node-accent-${id})` }) as CSSProperties

// The node button: opens the list of nodes, each reopening on its last view.
export function NodeSwitcher({ current, isAdmin }: { current: NodeDef; isAdmin: boolean }) {
  const t = useT()
  const router = useRouter()
  const { lastRoute } = useNodeMemory()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="group flex h-11 items-center gap-2 rounded-full border bg-card pr-3 pl-1.5 text-sm font-semibold shadow-[var(--shadow-soft)] outline-none transition-colors hover:border-node-accent/50 focus-visible:ring-[3px] focus-visible:ring-node-accent/40"
        aria-label={t('Switch node, now {node}', { node: t(current.label) })}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-node-accent/15 text-node-accent">
          <NodeIcon name={current.icon} className="size-4" />
        </span>
        {t(current.label)}
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-soft)]"
        >
          {NODES.map((node) => {
            const open = canOpen(node, isAdmin)
            const route = lastRoute(node.id)
            const view = viewFromPath(getNode(node.id), route)

            return (
              <DropdownMenu.Item
                key={node.id}
                disabled={!open}
                onSelect={() => router.push(route)}
                style={accentOf(node.id)}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-accent"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-node-accent/15 text-node-accent">
                  <NodeIcon name={node.icon} className="size-[1.125rem]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-sm font-semibold">{t(node.label)}</span>
                  <span className="text-xs text-muted-foreground">
                    {!open ? t('Coming soon') : view ? t('Last: {view}', { view: t(view.label) }) : null}
                  </span>
                </span>
                <Check
                  className={cn('size-4 text-node-accent', node.id === current.id ? 'visible' : 'invisible')}
                  aria-hidden="true"
                />
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// On wide screens the node button opens the life graph instead of a list.
export function GraphTrigger({
  ref,
  current,
  expanded,
  onOpen,
}: {
  ref: Ref<HTMLButtonElement>
  current: NodeDef
  expanded: boolean
  onOpen: () => void
}) {
  const t = useT()

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-expanded={expanded}
      aria-controls="life-graph"
      title={t('Open the life graph (G)')}
      className="group flex h-11 items-center gap-2 rounded-full border bg-card pr-3 pl-1.5 text-sm font-semibold shadow-[var(--shadow-soft)] outline-none transition-colors hover:border-node-accent/50 focus-visible:ring-[3px] focus-visible:ring-node-accent/40"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-node-accent/15 text-node-accent">
        <NodeIcon name={current.icon} className="size-4" />
      </span>
      {t(current.label)}
      <Waypoints className="size-4 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}
