import type { PropsWithChildren } from 'react'

import { FinanceBottomNav } from './finance-bottom-nav'

export default function FinanceLayout({ children }: PropsWithChildren) {
  return (
    <div className="theme-shell bg-transparent text-[var(--text)]">
      <div className="pb-24">{children}</div>
      <FinanceBottomNav />
    </div>
  )
}
