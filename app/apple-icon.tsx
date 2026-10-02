import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// The home-screen icon on phones: the same mark as app/icon.svg, as a PNG.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0f172a' }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path
            d="M32 15a17 17 0 1 1-17 17"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="5.5" fill="#60a5fa" />
        </svg>
      </div>
    ),
    size,
  )
}
