import type { ReactNode } from 'react'
import Link from 'next/link'
import { CalendarCheck, PiggyBank, ShieldCheck, Wallet } from 'lucide-react'

import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'

import { LanguageCornerButton } from './language'

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: m('A daily budget you can trust'),
    text: m('Derived from your income and allocations, so you know what today can afford.'),
  },
  {
    icon: PiggyBank,
    title: m('Savings with a purpose'),
    text: m('Move what you keep into chests and track the goals they fund.'),
  },
  {
    icon: ShieldCheck,
    title: m('Every deviation explained'),
    text: m('Record what went off plan and why, then adjust the next cycle.'),
  },
]

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex min-h-11 items-center gap-3 ${className ?? ''}`}>
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-5" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold tracking-tight">Personal Life Manager</span>
    </Link>
  )
}

// The two-column frame shared by the sign-in and sign-up pages: what the app
// does on the left (large screens only), the form on the right.
export async function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  const t = await getT()

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <LanguageCornerButton />
      <section className="relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--accent-soft),transparent_55%)]"
          aria-hidden="true"
        />

        <Brand className="relative" />

        <div className="relative max-w-md">
          <p className="text-3xl font-semibold tracking-tight xl:text-4xl">{t('Know what you can spend today.')}</p>
          <p className="mt-4 text-muted-foreground">
            {t('Plan your income once, then let every day start with a clear number.')}
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title: highlight, text }) => (
              <li key={highlight} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">{t(highlight)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Personal Life Manager
        </p>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          {/* Right margin keeps the brand clear of the language and theme buttons */}
          <Brand className="mr-28 mb-8 lg:hidden" />

          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

          {children}

          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </section>
    </main>
  )
}
