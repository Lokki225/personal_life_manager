import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Database, Eye, HardDrive, Mail, ShieldCheck, Smartphone, UserRound, type LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'

import { Brand } from '../auth-shell'
import { LanguageCornerButton } from '../language'
import { SignedInMenu } from '../signed-in-menu'

export const metadata: Metadata = {
  title: 'Privacy | Personal Life Manager',
}

// What the app keeps about a person, where, who else sees it, and for how
// long (security plan, decision D6). A plain-words draft, not legal advice:
// the owner reviews it before it is final.

type Section = { icon: LucideIcon; title: string; points: string[] }

const SECTIONS: Section[] = [
  {
    icon: UserRound,
    title: m('What is kept'),
    points: [
      m('Your account: your name, your email and your password, stored only as a hash that cannot be read back. A picture and the other profile fields if you add them.'),
      m('What you record: incomes, plan, expenses, savings, chests, debts and goals in Finance; tasks, sessions, goals and journal entries in Personal; positions and their pay, qualifications, skills, evidence links, opportunities and goals in Career.'),
      m('A locked journal entry is stored encrypted with its password. Without the password, nobody can read it, not even the administrator.'),
      m('Your notification choices, the addresses your devices give for notifications, and the opinions you send.'),
    ],
  },
  {
    icon: Database,
    title: m('Where it is kept'),
    points: [
      m('The app runs on Vercel. Your data is in a Postgres database at Neon, in the United States.'),
      m('Neon keeps the history of changes for a short time, so the database can be restored after a problem.'),
    ],
  },
  {
    icon: Smartphone,
    title: m('On your device'),
    points: [
      m('To work without a connection, the app keeps on your device a read-only copy of a few screens, what you are typing in a capture form, and what waits to be sent.'),
      m('Signing out erases all of it from the device. A password is never kept there, and nothing of Career is: your pay stays on the server.'),
    ],
  },
  {
    icon: Eye,
    title: m('Who else sees it'),
    points: [
      m('Nothing is sold or shared for advertising.'),
      m('Services that do work for the app receive only what that work needs: Vercel and Neon run and store it, Resend sends emails such as password reset links.'),
      m('When you use the assistant, your question and the records it reads to answer are sent to the AI provider the administrator chose.'),
      m('If you connect a chess.com account, only your public username is used to read your rating.'),
      m('The administrator sees the list of accounts, how much each one is used, and the security log. Not your entries.'),
    ],
  },
  {
    icon: ShieldCheck,
    title: m('The security log'),
    points: [
      m('To protect accounts, the app notes failed sign-ins (the email tried and the network address), limits reached, wrong journal passwords and changes to sign-in details.'),
      m('These notes are kept 90 days.'),
    ],
  },
  {
    icon: Clock,
    title: m('How long'),
    points: [
      m('Your data is kept as long as your account exists.'),
      m('When you delete your account, everything in it is deleted at once. It stays only in the database’s short restore history, until that passes.'),
    ],
  },
  {
    icon: HardDrive,
    title: m('Your choices'),
    points: [
      m('Download everything you recorded from My account, at any time.'),
      m('Delete your account from My account. It cannot be undone.'),
      m('Turn each kind of notification on or off from My account.'),
    ],
  },
  {
    icon: Mail,
    title: m('A question'),
    points: [m('Send an opinion from the app: it reaches the administrator, who answers.')],
  },
]

export default async function PrivacyPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const updated = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(2026, 9, 5))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
      {user ? <SignedInMenu /> : <LanguageCornerButton />}

      {/* Right padding keeps the brand clear of the two round buttons */}
      <header className="py-4 pr-28">
        <Brand />
      </header>

      <main className="space-y-6 py-6 sm:py-10">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('Updated {date}', { date: updated })}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t('Your data, in plain words')}</h1>
          <p className="mt-3 text-base text-muted-foreground">{t('What the app keeps about you, where, who else sees it, and how to take it back.')}</p>
        </section>

        {SECTIONS.map(({ icon: Icon, title, points }) => (
          <Card key={title} className="gap-0 py-5">
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                {t(title)}
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {points.map((point) => (
                  <li key={point}>{t(point)}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <p className="text-sm text-muted-foreground">
          <Link href={user ? '/account' : '/'} className="underline underline-offset-4 hover:text-foreground">
            {user ? t('Back to my account') : t('Back to the home page')}
          </Link>
        </p>
      </main>
    </div>
  )
}
