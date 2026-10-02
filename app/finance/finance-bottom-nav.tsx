'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, ChartNoAxesColumn, PiggyBank, type LucideIcon } from 'lucide-react'

import { useT } from '@/lib/i18n/client'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

type Section = {
  href: string
  label: string
  icon: LucideIcon
  // Routes that belong to this tab, and the pages it groups.
  matches: (pathname: string) => boolean
  pages?: { href: string; label: string }[]
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

const SECTIONS: Section[] = [
  {
    href: '/finance/chests',
    label: m('Savings'),
    icon: PiggyBank,
    matches: (pathname) =>
      under(pathname, '/finance/chests') || under(pathname, '/finance/goals') || under(pathname, '/finance/debts'),
    pages: [
      { href: '/finance/chests', label: m('Chests') },
      { href: '/finance/goals', label: m('Goals') },
      { href: '/finance/debts', label: m('Debts') },
    ],
  },
  {
    href: '/finance',
    label: m('Today'),
    icon: CalendarCheck,
    matches: (pathname) => pathname === '/finance' || under(pathname, '/finance/today'),
  },
  {
    href: '/finance/review',
    label: m('Review'),
    icon: ChartNoAxesColumn,
    matches: (pathname) => under(pathname, '/finance/review') || under(pathname, '/finance/history'),
    pages: [
      { href: '/finance/review', label: m('Review') },
      { href: '/finance/history', label: m('History') },
    ],
  },
]

const isSetup = (pathname: string) => under(pathname, '/finance/setup')

// Switches between the pages grouped under the current tab, e.g. Chests and Goals.
export function FinanceSectionTabs() {
  const t = useT()
  const pathname = usePathname()
  const pages = SECTIONS.find((section) => section.matches(pathname))?.pages

  if (!pages) {
    return null
  }

  return (
    <nav className="mx-auto w-full max-w-2xl px-4 pt-6 pr-32 sm:px-6 sm:pr-32" aria-label={t('Section pages')}>
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

export function FinanceBottomNav() {
  const t = useT()
  const pathname = usePathname()

  if (isSetup(pathname)) {
    return null
  }

  return (
    <nav
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2"
      aria-label={t('Finance navigation')}
    >
      <div className="flex items-center gap-1 rounded-2xl border bg-card/90 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-md">
        {SECTIONS.map(({ href, label, icon: Icon, matches }) => {
          const isActive = matches(pathname)

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {t(label)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
