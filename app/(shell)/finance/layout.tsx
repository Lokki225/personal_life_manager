import { Suspense, type PropsWithChildren } from 'react'

import { isAssistantConfigured } from '@/infrastructure/ai/providers'

import { AssistantWidget } from './assistant/assistant-widget'
import { FinanceSectionTabs } from './section-tabs'

// An answer of the assistant can take several steps of the model.
export const maxDuration = 60

export default function FinanceLayout({ children }: PropsWithChildren) {
  return (
    <>
      <FinanceSectionTabs />
      {children}
      {isAssistantConfigured() ? (
        // It reads the address, to open itself from a notification.
        <Suspense fallback={null}>
          <AssistantWidget />
        </Suspense>
      ) : null}
    </>
  )
}
