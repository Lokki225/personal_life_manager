import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages a visitor can open without an account.
const PUBLIC_PATHS = ['/', '/login', '/signup', '/learn', '/favicon.ico']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/((?!api|_next|login|signup|favicon.ico).*)'],
}
