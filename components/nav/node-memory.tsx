'use client'

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import {
  parseLastRoutes,
  parseStack,
  previousRoute,
  recordRoute,
  rememberRoute,
  type Arrival,
  type LastRoutes,
} from '@/lib/nav/history'
import { getNode, lastRouteOf, type NodeId } from '@/lib/nav/registry'

// The last route of each node (kept on this device) and the routes visited in
// this session (kept for the tab), for the switcher and the back button.
const LAST_ROUTES_KEY = 'pls.nav.lastRoutes'
const HISTORY_KEY = 'pls.nav.history'

type NodeMemory = {
  lastRoute: (id: NodeId) => string
  previous: string | null
}

const NodeMemoryContext = createContext<NodeMemory>({
  lastRoute: (id) => lastRouteOf(getNode(id), undefined),
  previous: null,
})

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: unknown) {
  try {
    storage().setItem(key, JSON.stringify(value))
  } catch {
    // Without storage, the memory lasts as long as the page.
  }
}

export function NodeMemoryProvider({ children }: PropsWithChildren) {
  const [memory, setMemory] = useState<{ lastRoutes: LastRoutes; stack: string[] }>({ lastRoutes: {}, stack: [] })
  const loaded = useRef<{ lastRoutes: LastRoutes; stack: string[] } | null>(null)

  const record = useCallback((route: string, arrival: Arrival) => {
    const current = loaded.current ?? {
      lastRoutes: parseLastRoutes(read(() => localStorage, LAST_ROUTES_KEY)),
      stack: parseStack(read(() => sessionStorage, HISTORY_KEY)),
    }
    const next = { lastRoutes: rememberRoute(current.lastRoutes, route), stack: recordRoute(current.stack, route, arrival) }

    if (next.lastRoutes !== current.lastRoutes) {
      write(() => localStorage, LAST_ROUTES_KEY, next.lastRoutes)
    }
    if (next.stack !== current.stack) {
      write(() => sessionStorage, HISTORY_KEY, next.stack)
    }

    loaded.current = next
    setMemory(next)
  }, [])

  const lastRoute = useCallback((id: NodeId) => lastRouteOf(getNode(id), memory.lastRoutes[id]), [memory.lastRoutes])

  return (
    <NodeMemoryContext.Provider value={{ lastRoute, previous: previousRoute(memory.stack) }}>
      {/* Reading the search params needs its own boundary, so the page around it still renders on the server. */}
      <Suspense fallback={null}>
        <RouteRecorder onRoute={record} />
      </Suspense>
      {children}
    </NodeMemoryContext.Provider>
  )
}

function RouteRecorder({ onRoute }: { onRoute: (route: string, arrival: Arrival) => void }) {
  const pathname = usePathname()
  const query = useSearchParams().toString()
  const route = query ? `${pathname}?${query}` : pathname
  // Set by the browser's back and forward, just before the route changes.
  const popped = useRef(false)

  useEffect(() => {
    const onPop = () => {
      popped.current = true
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    onRoute(route, popped.current ? 'pop' : 'push')
    popped.current = false
  }, [route, onRoute])

  return null
}

export const useNodeMemory = () => useContext(NodeMemoryContext)
