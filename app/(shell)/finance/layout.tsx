import type { PropsWithChildren } from 'react'

import { FinanceSectionTabs } from './section-tabs'

export default function FinanceLayout({ children }: PropsWithChildren) {
  return (
    <>
      <FinanceSectionTabs />
      {children}
    </>
  )
}
