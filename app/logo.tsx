import { cn } from '@/lib/utils'

// The app's mark: a day that is three quarters run, around a single point.
// The ring takes the text colour of its tile, so it follows the theme. The
// same drawing is in app/icon.svg and app/apple-icon.tsx.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-6', className)} aria-hidden="true">
      <path
        d="M32 9a23 23 0 1 1-23 23"
        fill="none"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="7.5" className="fill-ring" />
    </svg>
  )
}

// The mark on its tile, as shown next to the app's name.
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground',
        className,
      )}
    >
      <LogoMark className="size-[62%]" />
    </span>
  )
}
