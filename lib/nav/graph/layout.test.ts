import { describe, expect, it } from 'vitest'

import { NODES } from '../registry'
import { CANVAS, CHIP_HEIGHT, GRAPH_EDGES, HUB, layoutGraph } from './layout'

const nodes = NODES.map((n) => ({ id: n.id, views: n.views.map((v) => ({ id: v.id, label: v.label })) }))
const laid = layoutGraph(nodes, GRAPH_EDGES)
const at = (id: string) => laid.nodes.find((n) => n.id === id)!
const distance = (a: { x: number; y: number }) => Math.hypot(a.x - HUB.x, a.y - HUB.y)

describe('layoutGraph', () => {
  it('puts the four nodes in their quadrants, clockwise from the top left', () => {
    expect(at('finance').x).toBeLessThan(HUB.x)
    expect(at('finance').y).toBeLessThan(HUB.y)
    expect(at('personal').x).toBeGreaterThan(HUB.x)
    expect(at('personal').y).toBeLessThan(HUB.y)
    expect(at('career').x).toBeGreaterThan(HUB.x)
    expect(at('career').y).toBeGreaterThan(HUB.y)
    expect(at('projection').x).toBeLessThan(HUB.x)
    expect(at('projection').y).toBeGreaterThan(HUB.y)
  })

  it('fans every view out, farther from the hub than its node', () => {
    for (const chip of laid.chips) {
      expect(distance(chip)).toBeGreaterThan(distance(at(chip.node)))
    }
    expect(laid.chips).toHaveLength(nodes.reduce((sum, n) => sum + n.views.length, 0))
  })

  it('keeps every chip inside the canvas, even with longer French labels', () => {
    const french = layoutGraph(
      nodes.map((n) => ({ ...n, views: n.views.map((v) => ({ ...v, label: `${v.label} xxxxx` })) })),
      GRAPH_EDGES,
    )
    for (const chip of french.chips) {
      expect(chip.x - chip.w / 2).toBeGreaterThanOrEqual(0)
      expect(chip.x + chip.w / 2).toBeLessThanOrEqual(CANVAS.width)
      expect(chip.y - CHIP_HEIGHT / 2).toBeGreaterThanOrEqual(0)
      expect(chip.y + CHIP_HEIGHT / 2).toBeLessThanOrEqual(CANVAS.height)
    }
  })

  it('links neighbours with a curve, and skips a link to an unknown node', () => {
    expect(laid.links).toHaveLength(4)
    expect(laid.links[0].d).toMatch(/^M[\d.]+ [\d.]+ Q/)
    expect(layoutGraph(nodes, [{ from: 'finance', to: 'nowhere' as never, label: 'x' }]).links).toEqual([])
  })
})
