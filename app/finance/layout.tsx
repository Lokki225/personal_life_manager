import { Suspense, type PropsWithChildren } from 'react'

import { isAssistantConfigured } from '@/infrastructure/ai/providers'

import { SignedInMenu } from '../signed-in-menu'
import { AssistantWidget } from './assistant/assistant-widget'
import { FinanceBottomNav, FinanceSectionTabs } from './finance-bottom-nav'

// An answer of the assistant can take several steps of the model.
export const maxDuration = 60

export default function FinanceLayout({ children }: PropsWithChildren) {
  return (
    <div className="theme-shell text-foreground">
      <SignedInMenu />
      <FinanceSectionTabs />
      {/* Clears the fixed bottom navigation */}
      <div className="pb-28">{children}</div>
      <FinanceBottomNav />
      {isAssistantConfigured() ? (
        // It reads the address, to open itself from a notification.
        <Suspense fallback={null}>
          <AssistantWidget />
        </Suspense>
      ) : null}
    </div>
  )
}
