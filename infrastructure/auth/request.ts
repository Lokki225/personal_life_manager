import { headers } from 'next/headers'

// The network address a request came from, used to limit repeated attempts.
// Behind the host's proxy the first entry of x-forwarded-for is the visitor.
export async function clientIp(): Promise<string> {
  const headerList = await headers()

  return headerList.get('x-forwarded-for')?.split(',')[0].trim() || headerList.get('x-real-ip') || 'unknown'
}

// The address the site is being visited at, for links sent to people.
export async function siteUrl(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const protocol = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')

  return `${protocol}://${host}`
}
