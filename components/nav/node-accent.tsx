'use client'

import type { PropsWithChildren } from 'react'
import { usePathname } from 'next/navigation'

import { isGlobalPath, nodeFromPath } from '@/lib/nav/registry'

import { accentOf, NEUTRAL_ACCENT } from './node-switcher'

// Gives everything inside the accent of the node being shown; pages outside
// every node (/projects) take a neutral one.
export function NodeAccent({ className, children }: PropsWithChildren<{ className?: string }>) {
  const pathname = usePathname()
  const node = nodeFromPath(pathname)
  const style = node ? accentOf(node.id) : isGlobalPath(pathname) ? NEUTRAL_ACCENT : undefined

  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}
