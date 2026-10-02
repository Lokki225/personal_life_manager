import { ImageResponse } from 'next/og'

const SIZES = [192, 512]

// The app's mark as a PNG of the asked size, for the home-screen icon and for
// notifications. The same drawing as app/icon.svg.
export async function GET(_request: Request, { params }: RouteContext<'/icons/[size]'>) {
  const size = Number((await params).size)

  if (!SIZES.includes(size)) {
    return new Response('Not found', { status: 404 })
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0f172a' }}>
        {/* Drawn a little smaller than the square, so a round mask keeps it whole. */}
        <svg width={size} height={size} viewBox="-10 -10 84 84">
          <path d="M32 15a17 17 0 1 1-17 17" fill="none" stroke="#f8fafc" strokeWidth="6.5" strokeLinecap="round" />
          <circle cx="32" cy="32" r="5.5" fill="#60a5fa" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
