import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CalendarCheck, PiggyBank, ShieldCheck, Wallet } from 'lucide-react'

import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'

import { safeCallbackUrl } from './callbackUrl'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in | Personal Life Manager',
}

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: 'A daily budget you can trust',
    text: 'Derived from your income and allocations, so you know what today can afford.',
  },
  {
    icon: PiggyBank,
    title: 'Savings with a purpose',
    text: 'Move what you keep into chests and track the goals they fund.',
  },
  {
    icon: ShieldCheck,
    title: 'Every deviation explained',
    text: 'Record what went off plan and why, then adjust the next cycle.',
  },
]

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl)

  if (await getSignedInUserId()) {
    redirect(callbackUrl)
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--accent-soft),transparent_55%)]"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Personal Life Manager</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-3xl font-semibold tracking-tight xl:text-4xl">Know what you can spend today.</p>
          <p className="mt-4 text-muted-foreground">
            Plan your income once, then let every day start with a clear number.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
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
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Personal Life Manager</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to see today&apos;s budget.</p>

          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </section>
    </main>
  )
}
