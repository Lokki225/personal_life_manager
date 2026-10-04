import { getNode, lastRouteOf, nodeFromPath, type NodeId } from './registry'

// The routes visited in the nodes during this browser session, oldest first,
// so the back button knows whether there is a previous page and can name it.
// The browser keeps the real history; this list only mirrors it.

export const HISTORY_LIMIT = 50

// How the route was reached: a link or `router.push` ('push'), or the
// browser's back and forward ('pop').
export type Arrival = 'push' | 'pop'

export function recordRoute(stack: string[], route: string, arrival: Arrival): string[] {
  if (stack.at(-1) === route) {
    return stack
  }

  // Going back lands on the route before the current one.
  if (arrival === 'pop' && stack.at(-2) === route) {
    return stack.slice(0, -1)
  }

  return [...stack, route].slice(-HISTORY_LIMIT)
}

export const previousRoute = (stack: string[]): string | null => stack.at(-2) ?? null

// The last route of each node, as remembered on this device.
export type LastRoutes = Partial<Record<NodeId, string>>

// Remembers a route as its node's last one, when it is one of the node's views.
export function rememberRoute(memory: LastRoutes, route: string): LastRoutes {
  const node = nodeFromPath(route)

  if (!node || lastRouteOf(node, route) !== route || memory[node.id] === route) {
    return memory
  }

  return { ...memory, [node.id]: route }
}

// Reads what storage gave back, keeping only routes that still lead somewhere.
export function parseLastRoutes(raw: string | null): LastRoutes {
  let value: unknown

  try {
    value = raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }

  if (!value || typeof value !== 'object') {
    return {}
  }

  const memory: LastRoutes = {}

  for (const [id, route] of Object.entries(value)) {
    const node = typeof route === 'string' ? nodeFromPath(route) : null

    if (node && node.id === id && lastRouteOf(getNode(node.id), route) === route) {
      memory[node.id] = route
    }
  }

  return memory
}

export function parseStack(raw: string | null): string[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value)
      ? value.filter((route): route is string => typeof route === 'string' && nodeFromPath(route) !== null).slice(-HISTORY_LIMIT)
      : []
  } catch {
    return []
  }
}
