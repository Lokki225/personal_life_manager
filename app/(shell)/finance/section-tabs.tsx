'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { getNode, viewFromPath } from '@/lib/nav/registry'
import { cn } from '@/lib/utils'

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

// The pages grouped under a Finance view (see lib/nav/registry.ts).
const PAGES: Record<string, { href: string; label: string }[]> = {
  savings: [
    { href: '/finance/chests', label: m('Chests') },
    { href: '/finance/goals', label: m('Goals') },
    { href: '/finance/debts', label: m('Debts') },
  ],
  review: [
    { href: '/finance/review', label: m('Review') },
    { href: '/finance/history', label: m('History') },
  ],
}

// Switches between the pages grouped under the current view, e.g. Chests and Goals.
export function FinanceSectionTabs() {
  const t = useT()
  const pathname = usePathname()
  const view = viewFromPath(getNode('finance'), pathname)
  const pages = view ? PAGES[view.id] : undefined

  if (!pages) {
    return null
  }

  return (
    <nav className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6" aria-label={t('Section pages')}>
      <div className="inline-flex rounded-lg bg-muted p-1">
        {pages.map((page) => {
          const isActive = under(pathname, page.href)

          return (
            <Link
              key={page.href}
              href={page.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors sm:px-4',
                isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(page.label)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
