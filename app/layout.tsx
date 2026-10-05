import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { ServiceWorker } from '@/components/offline/service-worker'
import { I18nProvider } from '@/lib/i18n/client'
import { getLocale } from '@/lib/i18n/server'

import { ThemeToggle } from './theme-toggle'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Personal Life Manager',
  description: 'Finance-first personal life manager MVP',
}

const themeScript = `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)})()`

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved (or system) theme before first paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-[var(--accent-soft)] selection:text-foreground">
        <I18nProvider locale={locale}>
          <ThemeToggle />
          <ServiceWorker />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
