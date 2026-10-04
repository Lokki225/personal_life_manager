import { m } from '@/lib/i18n/translate'

import type { NodeId } from '../registry'

// The life graph's geometry (Ressources/life-graph-overlay-specification.md
// §4): nodes on an ellipse around a "You" hub, each node's views fanning out
// away from the hub, and curved links between neighbouring nodes. Pure, in a
// fixed 1000 × 590 space that the SVG scales.

export type GraphEdge = { from: NodeId; to: NodeId; label: string; kind: 'flow' | 'graduation' | 'check' | 'feeds' }

// Only neighbours on the ring are linked, so no line crosses the hub.
export const GRAPH_EDGES: GraphEdge[] = [
  { from: 'finance', to: 'personal', label: m('funds goals'), kind: 'flow' },
  { from: 'personal', to: 'career', label: m('skills feed career'), kind: 'feeds' },
  { from: 'career', to: 'projection', label: m('ideas graduate'), kind: 'graduation' },
  { from: 'projection', to: 'finance', label: m('commitment check'), kind: 'check' },
]

// 590 high, not the spec's 560: the lowest view chips reach y = 570.
export const CANVAS = { width: 1000, height: 590 }
export const HUB = { x: 500, y: 290, r: 26 }
const RX = 382
const RY = 180
const CHIP_DISTANCE = 138
const SPREAD = (62 * Math.PI) / 180
export const CHIP_HEIGHT = 30

export type Point = { x: number; y: number }

export type LaidOut = {
  nodes: ({ id: NodeId } & Point)[]
  chips: ({ node: NodeId; view: string; label: string; w: number } & Point)[]
  links: { from: NodeId; to: NodeId; label: string; d: string; lx: number; ly: number }[]
}

const round = (value: number) => Math.round(value * 10) / 10

export const chipWidth = (label: string) => label.length * 8 + 26

export function layoutGraph(
  nodes: { id: NodeId; views: { id: string; label: string }[] }[],
  edges: { from: NodeId; to: NodeId; label: string }[],
): LaidOut {
  const count = nodes.length
  const position = new Map<NodeId, Point>()

  // Evenly on the ellipse, clockwise from the top left.
  const laidNodes = nodes.map((node, i) => {
    const angle = ((-135 + (i * 360) / count) * Math.PI) / 180
    const point = { x: round(HUB.x + RX * Math.cos(angle)), y: round(HUB.y + RY * Math.sin(angle)) }
    position.set(node.id, point)
    return { id: node.id, ...point }
  })

  const chips = nodes.flatMap((node) => {
    const p = position.get(node.id)!
    const away = Math.atan2(p.y - HUB.y, p.x - HUB.x)
    const k = node.views.length

    return node.views.map((view, j) => {
      const angle = k === 1 ? away : away - SPREAD + (2 * SPREAD * j) / (k - 1)
      return {
        node: node.id,
        view: view.id,
        label: view.label,
        w: chipWidth(view.label),
        x: round(p.x + CHIP_DISTANCE * Math.cos(angle)),
        y: round(p.y + CHIP_DISTANCE * Math.sin(angle)),
      }
    })
  })

  const links = edges.flatMap((edge) => {
    const a = position.get(edge.from)
    const b = position.get(edge.to)
    if (!a || !b) return []

    // A curve bowing outward, away from the hub, labelled at its middle.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const control = { x: mid.x + (mid.x - HUB.x) * 0.55, y: mid.y + (mid.y - HUB.y) * 0.55 }
    return [
      {
        from: edge.from,
        to: edge.to,
        label: edge.label,
        d: `M${a.x} ${a.y} Q${round(control.x)} ${round(control.y)} ${b.x} ${b.y}`,
        lx: round(0.25 * a.x + 0.5 * control.x + 0.25 * b.x),
        ly: round(0.25 * a.y + 0.5 * control.y + 0.25 * b.y - 6),
      },
    ]
  })

  return { nodes: laidNodes, chips, links }
}
