'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

import { useT } from '@/lib/i18n/client'
import { CANVAS, CHIP_HEIGHT, GRAPH_EDGES, HUB, layoutGraph } from '@/lib/nav/graph/layout'
import { canOpen, canOpenProjects, type NodeDef, type NodeId, NODES, PROJECTS } from '@/lib/nav/registry'
import { cn } from '@/lib/utils'

import { NodeIcon } from './node-icon'
import { useNodeMemory } from './node-memory'

type Badges = Partial<Record<NodeId, string | null>>

const accent = (id: NodeId) => ({ '--c': `var(--node-accent-${id})` }) as CSSProperties

// The life graph over the whole app: every node with its live line and its
// views, and how nodes relate. A node opens its last view, a chip that view.
export function LifeGraphOverlay({
  open,
  origin,
  current,
  currentView,
  isAdmin,
  onClose,
  onGo,
}: {
  open: boolean
  origin: { x: number; y: number }
  // Null on a page outside every node.
  current: NodeDef | null
  currentView: string | null
  isAdmin: boolean
  onClose: () => void
  onGo: (href: string) => void
}) {
  const t = useT()
  const { lastRoute } = useNodeMemory()
  const container = useRef<HTMLDivElement>(null)
  const [badges, setBadges] = useState<Badges | null>(null)

  const laid = useMemo(
    () =>
      layoutGraph(
        NODES.map((n) => ({ id: n.id, views: n.views.map((v) => ({ id: v.id, label: t(v.label) })) })),
        GRAPH_EDGES.map((e) => ({ ...e, label: t(e.label) })),
      ),
    [t],
  )

  // Badges load once the graph opens and never hold up the reveal.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/nav/badges')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Badges) => !cancelled && setBadges(data))
      .catch(() => !cancelled && setBadges({}))
    return () => {
      cancelled = true
    }
  }, [open])

  // Focus moves to the current node once the reveal is under way.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => container.current?.querySelector<SVGElement>('[data-current="true"]')?.focus({ preventScroll: true }), 120)
    return () => clearTimeout(timer)
  }, [open])

  // Keeps Tab inside the graph while it is open.
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const items = [...(container.current?.querySelectorAll<HTMLElement | SVGElement>('[data-focus]') ?? [])].filter((item) => item.tabIndex >= 0)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const activate = (event: KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  const byId = new Map(NODES.map((n) => [n.id, n]))
  const position = new Map(laid.nodes.map((n) => [n.id, n]))

  return (
    <div
      ref={container}
      id="life-graph"
      role="dialog"
      aria-modal="true"
      aria-label={t('Life graph')}
      aria-hidden={!open}
      data-open={open}
      onKeyDown={trapFocus}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="graph-overlay text-foreground"
      style={{ '--cx': `${origin.x}px`, '--cy': `${origin.y}px` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('Life graph')}</h2>
          <p className="text-sm text-muted-foreground">{t('Pick a node to return to its last view, or jump straight to any view.')}</p>
        </div>
        <button
          type="button"
          data-focus
          tabIndex={open ? 0 : -1}
          onClick={onClose}
          className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-node-accent/40"
        >
          <X className="size-4" aria-hidden="true" />
          {t('Esc · close')}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="min-h-0 w-full flex-1"
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        {/* Links between nodes: decorative, described below for screen readers. */}
        <g aria-hidden="true">
          {laid.links.map((link) => (
            <g key={`${link.from}-${link.to}`}>
              <path d={link.d} fill="none" className="stroke-muted-foreground/40" strokeWidth={1.3} strokeDasharray="4 5" />
              <text x={link.lx} y={link.ly} textAnchor="middle" className="fill-muted-foreground text-[11.5px] italic">
                {link.label}
              </text>
            </g>
          ))}
        </g>

        <g aria-hidden="true">
          {laid.nodes.map((node) => (
            <line key={node.id} x1={HUB.x} y1={HUB.y} x2={node.x} y2={node.y} style={accent(node.id)} stroke="var(--c)" strokeOpacity={0.35} strokeWidth={1.4} />
          ))}
          {laid.chips.map((chip) => {
            const node = position.get(chip.node)!
            return (
              <line key={`${chip.node}-${chip.view}`} x1={node.x} y1={node.y} x2={chip.x} y2={chip.y} style={accent(chip.node)} stroke="var(--c)" strokeOpacity={0.28} strokeWidth={1.4} />
            )
          })}
          {/* The hub: everything that is yours across the nodes, your projects. */}
          <g
            role={canOpenProjects(isAdmin) ? 'button' : undefined}
            data-focus={canOpenProjects(isAdmin) ? true : undefined}
            tabIndex={open && canOpenProjects(isAdmin) ? 0 : -1}
            aria-label={canOpenProjects(isAdmin) ? t('Open all projects') : undefined}
            onClick={() => canOpenProjects(isAdmin) && onGo(PROJECTS.href)}
            onKeyDown={(event) => canOpenProjects(isAdmin) && activate(event, () => onGo(PROJECTS.href))}
            className={canOpenProjects(isAdmin) ? 'graph-item group cursor-pointer' : undefined}
          >
            <circle cx={HUB.x} cy={HUB.y} r={HUB.r} className="fill-card stroke-border group-hover:stroke-foreground group-focus-visible:stroke-foreground" />
            <text x={HUB.x} y={HUB.y + 5} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
              {t('You')}
            </text>
          </g>
        </g>

        {laid.nodes.map((laidNode) => {
          const node = byId.get(laidNode.id)!
          const enabled = canOpen(node, isAdmin)
          const isCurrent = node.id === current?.id
          const badge = !enabled ? t('Coming soon') : badges === null ? '…' : (badges[node.id] ?? '')
          const go = () => enabled && onGo(lastRoute(node.id))

          return (
            <g
              key={node.id}
              role="button"
              data-focus
              data-current={isCurrent}
              tabIndex={open && enabled ? 0 : -1}
              aria-disabled={!enabled}
              aria-label={enabled ? t('Open {node}, last view', { node: t(node.label) }) : t('{node}, coming soon', { node: t(node.label) })}
              onClick={go}
              onKeyDown={(event) => activate(event, go)}
              className="graph-item group"
              style={accent(node.id)}
            >
              {/* A larger invisible target, for fingers on a tablet. */}
              <circle cx={laidNode.x} cy={laidNode.y} r={58} fill="transparent" />
              <circle cx={laidNode.x} cy={laidNode.y} r={58} fill="var(--c)" opacity={isCurrent ? 0.22 : 0} />
              <circle
                cx={laidNode.x}
                cy={laidNode.y}
                r={40}
                className="fill-card transition-[stroke-width] group-hover:[stroke-width:4] group-focus-visible:[stroke-width:4]"
                stroke="var(--c)"
                strokeWidth={2}
              />
              <NodeIcon name={node.icon} x={laidNode.x - 14} y={laidNode.y - 14} width={28} height={28} color="var(--c)" />
              <text x={laidNode.x} y={laidNode.y + 64} textAnchor="middle" className="fill-foreground text-[15px] font-bold">
                {t(node.label)}
              </text>
              <text x={laidNode.x} y={laidNode.y + 82} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                {badge}
              </text>
            </g>
          )
        })}

        {laid.chips.map((chip, index) => {
          const node = byId.get(chip.node)!
          const view = node.views.find((v) => v.id === chip.view)!
          const enabled = canOpen(node, isAdmin)
          const isCurrent = node.id === current?.id && view.id === currentView
          const go = () => enabled && onGo(view.href)

          return (
            <g
              key={`${chip.node}-${chip.view}`}
              role="button"
              data-focus
              tabIndex={open && enabled ? 0 : -1}
              aria-disabled={!enabled}
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={t('Go to {node} {view}', { node: t(node.label), view: chip.label })}
              onClick={go}
              onKeyDown={(event) => activate(event, go)}
              className="graph-item graph-chip group"
              style={{ ...accent(chip.node), '--i': index } as CSSProperties}
            >
              <rect x={chip.x - chip.w / 2 - 6} y={chip.y - 24} width={chip.w + 12} height={48} fill="transparent" />
              <rect
                x={chip.x - chip.w / 2}
                y={chip.y - CHIP_HEIGHT / 2}
                width={chip.w}
                height={CHIP_HEIGHT}
                rx={CHIP_HEIGHT / 2}
                className={cn(!isCurrent && 'fill-card stroke-border group-hover:[stroke:var(--c)] group-focus-visible:[stroke:var(--c)]')}
                fill={isCurrent ? 'var(--c)' : undefined}
                stroke={isCurrent ? 'var(--c)' : undefined}
                strokeWidth={1.4}
              />
              <text
                x={chip.x}
                y={chip.y + 4.5}
                textAnchor="middle"
                className={cn('text-[13px]', isCurrent ? 'fill-on-node-accent font-semibold' : 'fill-foreground font-medium')}
                style={isCurrent ? { fill: 'var(--on-node-accent)' } : undefined}
              >
                {chip.label}
              </text>
            </g>
          )
        })}
      </svg>

      <ul className="sr-only">
        {laid.links.map((link) => (
          <li key={`${link.from}-${link.to}`}>
            {t('{from} to {to}: {label}', { from: t(byId.get(link.from)!.label), to: t(byId.get(link.to)!.label), label: link.label })}
          </li>
        ))}
      </ul>
    </div>
  )
}
