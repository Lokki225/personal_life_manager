import type { PropsWithChildren } from 'react'

import { FinanceBottomNav, FinanceSectionTabs } from './finance-bottom-nav'

export default function FinanceLayout({ children }: PropsWithChildren) {
  return (
    <div className="theme-shell text-foreground">
      <FinanceSectionTabs />
      {/* Clears the fixed bottom navigation */}
      <div className="pb-28">{children}</div>
      <FinanceBottomNav />
    </div>
  )
}
