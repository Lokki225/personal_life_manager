import { Suspense, type PropsWithChildren } from 'react'

import { AppBar } from '@/components/nav/app-bar'
import { BottomTabs } from '@/components/nav/bottom-tabs'
import { NodeAccent } from '@/components/nav/node-accent'
import { NodeMemoryProvider } from '@/components/nav/node-memory'
import { OfflineUserProvider } from '@/components/offline/offline-user'
import { isAssistantConfigured } from '@/infrastructure/ai/providers'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'

import { SignedInMenu } from '../signed-in-menu'
import { AssistantWidget } from './finance/assistant/assistant-widget'

// An answer of the assistant can take several steps of the model.
export const maxDuration = 60

// The frame shared by every node: back, the node button, the account menu and
// the bottom tabs of the node's views. Each node's own layout adds what is
// only its own.
export default async function ShellLayout({ children }: PropsWithChildren) {
  const user = await getSignedInUser()

  return (
    <OfflineUserProvider userId={user?.id ?? null}>
      <NodeMemoryProvider>
        <NodeAccent className="theme-shell text-foreground">
          <SignedInMenu />
          <AppBar isAdmin={user?.role === 'ADMIN'} />
          {/* Clears the fixed bottom tabs */}
          <div className="pb-28">{children}</div>
          <BottomTabs />
          {isAssistantConfigured() ? (
            // It reads the address, to open itself from a notification.
            <Suspense fallback={null}>
              <AssistantWidget />
            </Suspense>
          ) : null}
        </NodeAccent>
      </NodeMemoryProvider>
    </OfflineUserProvider>
  )
}
