'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/finance/today', label: 'Today' },
  { href: '/finance/history', label: 'History' },
  { href: '/finance/review', label: 'Review' },
  { href: '/finance/goals', label: 'Goals' },
  { href: '/projects', label: 'Projects' },
] as const

export function FinanceBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2" aria-label="Finance navigation">
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-2 py-2 shadow-[var(--shadow-soft)] backdrop-blur-md">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/projects' && pathname.startsWith(`${item.href}/`))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition ${
                isActive
                  ? 'bg-[var(--text)] text-[var(--panel-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
                  : 'text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--text)]'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
