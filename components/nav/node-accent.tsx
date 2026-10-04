'use client'

import type { PropsWithChildren } from 'react'
import { usePathname } from 'next/navigation'

import { nodeFromPath } from '@/lib/nav/registry'

import { accentOf } from './node-switcher'

// Gives everything inside the accent of the node being shown.
export function NodeAccent({ className, children }: PropsWithChildren<{ className?: string }>) {
  const node = nodeFromPath(usePathname())

  return (
    <div className={className} style={node ? accentOf(node.id) : undefined}>
      {children}
    </div>
  )
}
