import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages a visitor can open without an account.
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/learn',
  '/icon.svg',
  '/apple-icon',
  '/manifest.webmanifest',
  '/sw.js',
  '/icons/192',
  '/icons/512',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Browsers ask for this address on their own. They get the app's icon.
  if (pathname === '/favicon.ico') {
    return NextResponse.rewrite(new URL('/icon.svg', request.url))
  }

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/_next') || PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|login|signup|icon.svg|apple-icon).*)'],
}
