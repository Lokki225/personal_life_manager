import type { PropsWithChildren } from 'react'

import { AppBar } from '@/components/nav/app-bar'
import { BottomTabs } from '@/components/nav/bottom-tabs'
import { NodeAccent } from '@/components/nav/node-accent'
import { NodeMemoryProvider } from '@/components/nav/node-memory'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

import { SignedInMenu } from '../signed-in-menu'

// The frame shared by every node: back, the node button, the account menu and
// the bottom tabs of the node's views. Each node's own layout adds what is
// only its own.
export default async function ShellLayout({ children }: PropsWithChildren) {
  const user = await getSignedInUser()

  return (
    <NodeMemoryProvider>
      <NodeAccent className="theme-shell text-foreground">
        <SignedInMenu />
        <AppBar isAdmin={user?.role === 'ADMIN'} />
        {/* Clears the fixed bottom tabs */}
        <div className="pb-28">{children}</div>
        <BottomTabs />
      </NodeAccent>
    </NodeMemoryProvider>
  )
}
