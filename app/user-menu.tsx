'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { BookOpen, Check, Languages, LogOut, ShieldCheck, UserRound, Wallet } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { LOCALES } from '@/lib/i18n/config'
import { useT } from '@/lib/i18n/client'

import { Avatar } from './avatar'
import { useSetLocale } from './language'
import { LANGUAGE_NAMES } from './language-names'

const ITEM_CLASS =
  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

export type MenuUser = { name: string; email: string; picture: string | null; isAdmin: boolean }

// The signed-in person's picture at the top right. It opens their account,
// the language choice, the administration (for administrators) and sign out.
export function UserMenu({ user }: { user: MenuUser }) {
  const t = useT()
  const setLocale = useSetLocale()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="absolute right-[4.25rem] top-4 z-50 flex size-11 items-center justify-center rounded-full border bg-card shadow-[var(--shadow-soft)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={t('Account menu')}
      >
        <Avatar name={user.name} picture={user.picture} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={user.name} picture={user.picture} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

          <DropdownMenu.Item asChild className={ITEM_CLASS}>
            <Link href="/finance">
              <Wallet aria-hidden="true" />
              {t('Finance')}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={ITEM_CLASS}>
            <Link href="/account">
              <UserRound aria-hidden="true" />
              {t('My account')}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={ITEM_CLASS}>
            <Link href="/learn">
              <BookOpen aria-hidden="true" />
              {t('How it works')}
            </Link>
          </DropdownMenu.Item>
          {user.isAdmin ? (
            <DropdownMenu.Item asChild className={ITEM_CLASS}>
              <Link href="/admin">
                <ShieldCheck aria-hidden="true" />
                {t('Administration')}
              </Link>
            </DropdownMenu.Item>
          ) : null}

          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
          <DropdownMenu.Label className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Languages className="size-4" aria-hidden="true" />
            {t('Language')}
          </DropdownMenu.Label>
          {LOCALES.map((locale) => (
            <DropdownMenu.Item key={locale} className={ITEM_CLASS} onSelect={() => setLocale(locale)} lang={locale}>
              <span className="flex size-4 items-center justify-center">
                {t.locale === locale ? <Check aria-hidden="true" /> : null}
              </span>
              {LANGUAGE_NAMES[locale]}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={() => void signOut({ callbackUrl: '/' })}>
            <LogOut aria-hidden="true" />
            {t('Sign out')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
