import type { PropsWithChildren } from 'react'

import { isAssistantConfigured } from '@/infrastructure/ai/claude'

import { SignedInMenu } from '../signed-in-menu'
import { FinanceBottomNav, FinanceSectionTabs } from './finance-bottom-nav'

export default function FinanceLayout({ children }: PropsWithChildren) {
  return (
    <div className="theme-shell text-foreground">
      <SignedInMenu />
      <FinanceSectionTabs />
      {/* Clears the fixed bottom navigation */}
      <div className="pb-28">{children}</div>
      <FinanceBottomNav assistant={isAssistantConfigured()} />
    </div>
  )
}
